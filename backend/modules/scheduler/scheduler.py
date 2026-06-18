"""
Discovery Scheduler — APScheduler-backed recurring scan runner.
Loaded once at FastAPI startup; persists schedule state in the DB.
"""
import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from backend.core.infrastructure.database import SessionLocal
from backend.core.domain.models import DiscoverySchedule, DiscoveryJob

log = logging.getLogger("aii.scheduler")

_scheduler: Optional[BackgroundScheduler] = None


# ── Internal runner called by APScheduler ─────────────────────────────────────

def _run_schedule(schedule_id: int):
    """Spawns a discovery job for the given schedule."""
    db: Session = SessionLocal()
    try:
        schedule = db.query(DiscoverySchedule).filter(
            DiscoverySchedule.id == schedule_id,
            DiscoverySchedule.is_enabled == True,
        ).first()
        if not schedule:
            return

        targets = json.loads(schedule.targets)

        job = DiscoveryJob(
            organization_id=schedule.organization_id,
            site_id=schedule.site_id,
            created_by=schedule.created_by,
            name=f"[Scheduled] {schedule.name}",
            targets=json.dumps(targets),
            methods=schedule.methods,
            status="pending",
        )
        db.add(job)
        db.flush()

        schedule.last_run_at = datetime.utcnow()
        schedule.next_run_at = datetime.utcnow() + timedelta(minutes=schedule.interval_minutes)
        schedule.last_job_id = job.id
        db.commit()
        db.refresh(job)

        log.info(f"Scheduled discovery {schedule.name!r} → job #{job.id}")

        # Run the actual scan in a new event loop
        from backend.modules.discovery.engine import run_discovery
        from backend.modules.network_scan.scanner import expand_target
        asyncio.run(run_discovery(db, job.id, targets, schedule.organization_id, schedule.site_id))

    except Exception as e:
        log.error(f"Scheduled discovery error (schedule_id={schedule_id}): {e}", exc_info=True)
    finally:
        db.close()


# ── Lifecycle ──────────────────────────────────────────────────────────────────

def start_scheduler():
    global _scheduler
    _scheduler = BackgroundScheduler(timezone="UTC")

    db: Session = SessionLocal()
    try:
        schedules = db.query(DiscoverySchedule).filter(
            DiscoverySchedule.is_enabled == True
        ).all()
        for s in schedules:
            _register_job(s.id, s.interval_minutes)
            log.info(f"Loaded schedule {s.name!r} (every {s.interval_minutes}m)")
    finally:
        db.close()

    _scheduler.start()
    log.info(f"Discovery scheduler started ({len(_scheduler.get_jobs())} job(s) loaded)")


def stop_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        log.info("Discovery scheduler stopped")


# ── CRUD helpers ───────────────────────────────────────────────────────────────

def _register_job(schedule_id: int, interval_minutes: int):
    if _scheduler is None:
        return
    job_id = f"discovery_schedule_{schedule_id}"
    if _scheduler.get_job(job_id):
        _scheduler.remove_job(job_id)
    _scheduler.add_job(
        _run_schedule,
        trigger=IntervalTrigger(minutes=interval_minutes, timezone="UTC"),
        args=[schedule_id],
        id=job_id,
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )


def register_schedule(schedule_id: int, interval_minutes: int):
    _register_job(schedule_id, interval_minutes)


def unregister_schedule(schedule_id: int):
    if _scheduler is None:
        return
    job_id = f"discovery_schedule_{schedule_id}"
    if _scheduler.get_job(job_id):
        _scheduler.remove_job(job_id)


def get_scheduler_status() -> dict:
    if _scheduler is None or not _scheduler.running:
        return {"running": False, "jobs": 0}
    jobs = _scheduler.get_jobs()
    return {
        "running": True,
        "jobs": len(jobs),
        "job_ids": [j.id for j in jobs],
    }
