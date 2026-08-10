import { logger } from '../../utils/logger.js';

/**
 * BullMQ processor for notification jobs.
 *
 * This was a placeholder that logged and returned success, so anything routed through the
 * notification queue was silently discarded. It now performs the send and — critically —
 * THROWS on a retryable total failure, so BullMQ retries with backoff and, once attempts are
 * exhausted, parks the job on the failed set as a dead letter.
 *
 * Terminal failures (unregistered/invalid tokens, owner with no registered device) do not
 * throw: retrying those would burn attempts on something that can never succeed.
 *
 * @param {import('bullmq').Job} job
 */
export const processNotificationJob = async (job) => {
    const { action, targets, payload } = job?.data || {};

    if (action !== 'send-push') {
        logger.info(`[BullMQ:notification] ignoring unknown action '${action}' (job ${job.id})`);
        return { processed: true, jobId: job.id };
    }

    const list = Array.isArray(targets) ? targets.filter((t) => t?.ownerType && t?.ownerId) : [];
    if (list.length === 0) {
        logger.warn(`[BullMQ:notification] job ${job.id} has no valid targets`);
        return { processed: true, jobId: job.id, targets: 0 };
    }

    const attempt = Number(job.attemptsMade || 0) + 1;
    const { sendNotificationToOwners } = await import('../../core/notifications/firebase.service.js');

    // throwOnTotalFailure lets a retryable failure propagate; attempt is stamped on the receipt.
    const results = await sendNotificationToOwners(list, payload, {
        throwOnTotalFailure: true,
        attempt,
    });

    const successCount = results.reduce((n, r) => n + (r?.successCount || 0), 0);
    const failureCount = results.reduce((n, r) => n + (r?.failureCount || 0), 0);

    logger.info(
        `[BullMQ:notification] job ${job.id} attempt ${attempt}: ` +
        `${list.length} target(s), success=${successCount}, failure=${failureCount}`,
    );

    return { processed: true, jobId: job.id, targets: list.length, successCount, failureCount };
};
