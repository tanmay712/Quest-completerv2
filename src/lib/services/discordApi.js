const fs = require('fs');
const path = require('path');

const SUPER_PROPERTIES = Buffer.from(JSON.stringify({
    os: "Windows",
    browser: "Discord Client",
    release_channel: "stable",
    client_version: "1.0.9175",
    os_version: "10.0.19045",
    os_arch: "x64",
    app_arch: "x64",
    system_locale: "en-US",
    browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9175 Chrome/130.0.6723.137 Electron/33.2.2 Safari/537.36",
    browser_version: "33.2.2",
    client_build_number: 595000,
    native_build_number: null,
    client_event_source: null
})).toString('base64');

function sleep(ms, jitter = 400) {
    const randomJitter = Math.floor(Math.random() * jitter);
    return new Promise(resolve => setTimeout(resolve, ms + randomJitter));
}

function formatTimeRemaining(expiresAt) {
    if (!expiresAt) return 'soon';
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return 'expired';
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 30) return 'in a month';
    if (diffDays > 1) return `in ${diffDays} days *(${diffDays}d left)*`;
    if (diffDays === 1) return 'tomorrow *(1d left)*';
    return `in ${diffHours} hours`;
}

function formatTaskName(taskKey) {
    switch (taskKey) {
        case 'PLAY_ON_DESKTOP':
            return 'Play on Desktop';
        case 'STREAM_ON_DESKTOP':
            return 'Stream on Desktop';
        case 'WATCH_VIDEO':
        case 'WATCH_VIDEO_ON_MOBILE':
            return 'Watch Video on Discord';
        case 'PLAY_ACTIVITY':
            return 'Play Discord Activity';
        default:
            return taskKey.replace(/_/g, ' ');
    }
}

/**
 * Real Discord User API Service with Anti-Ban & Rate-Limit Protection
 */
class DiscordApiService {
    getHeaders(token) {
        const cleanToken = token.replace(/^(Bot\s+|Bearer\s+)/i, '').trim();
        return {
            'Authorization': cleanToken,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9175 Chrome/130.0.6723.137 Electron/33.2.2 Safari/537.36',
            'X-Super-Properties': SUPER_PROPERTIES,
            'X-Discord-Locale': 'en-US',
            'X-Discord-Timezone': 'Etc/UTC',
            'Referer': 'https://discord.com/channels/@me',
            'Origin': 'https://discord.com',
            'Sec-Ch-Ua': '"Chromium";v="130", "Not?A_Brand";v="99"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'Accept-Language': 'en-US,en;q=0.9'
        };
    }

    /**
     * Safe fetch with automatic rate-limit (429) backoff
     */
    async safeFetch(url, options = {}, retries = 2) {
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const res = await fetch(url, options);

                // Handle rate limiting (429) gracefully
                if (res.status === 429) {
                    const data = await res.json().catch(() => ({}));
                    const retryAfterSec = data.retry_after || parseFloat(res.headers.get('retry-after')) || 3;
                    console.log(`[Anti-Ban Protection] Rate limit hit (429). Sleeping for ${retryAfterSec}s before retrying...`);
                    await sleep(retryAfterSec * 1000 + 500);
                    continue;
                }

                return res;
            } catch (err) {
                if (attempt === retries) throw err;
                await sleep(1000);
            }
        }
        return fetch(url, options);
    }

    /**
     * Validates a Discord User token by querying /users/@me
     */
    async validateUserToken(token) {
        try {
            console.log(`[DiscordAPI] Validating user token session...`);
            const res = await this.safeFetch('https://discord.com/api/v9/users/@me', {
                headers: this.getHeaders(token)
            });

            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                return { valid: false, error: `Discord API returned ${res.status}: ${errText}` };
            }

            const data = await res.json();
            return {
                valid: true,
                user: {
                    id: data.id,
                    username: data.username,
                    discriminator: data.discriminator,
                    avatar: data.avatar,
                    globalName: data.global_name || data.username,
                    nitroType: data.premium_type,
                    flags: data.flags
                }
            };
        } catch (err) {
            console.error(`[DiscordAPI] validateUserToken error:`, err.message);
            return { valid: false, error: err.message };
        }
    }

    /**
     * Fetch user's real active quests from Discord /quests/@me
     */
    async fetchUserQuests(token) {
        try {
            console.log(`[DiscordAPI] Querying /quests/@me with official client signature...`);
            const res = await this.safeFetch('https://discord.com/api/v9/quests/@me', {
                headers: this.getHeaders(token)
            });

            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                console.log(`[DiscordAPI] /quests/@me error: status ${res.status}`);
                return { success: false, status: res.status, error: errText, quests: [], rawQuests: [] };
            }

            const data = await res.json();
            const rawList = data.quests || [];
            console.log(`[DiscordAPI] Retrieved ${rawList.length} total quest records from Discord.`);

            // Persist raw list to disk for inspection & debugging
            try {
                fs.writeFileSync(
                    path.join(__dirname, '../../data/active_quests.json'),
                    JSON.stringify(rawList, null, 2),
                    'utf8'
                );
            } catch (e) {}

            const formattedQuests = rawList.map((q, index) => {
                const config = q.config || {};
                const messages = config.messages || {};
                const application = config.application || {};
                const taskConfig = config.task_config || config.task_config_v2 || {};
                const tasks = taskConfig.tasks || {};
                const taskKeys = Object.keys(tasks);

                const primaryTaskKey = taskKeys[0] || 'PLAY_ON_DESKTOP';
                const targetSeconds = tasks[primaryTaskKey]?.target || 900;
                const durationMinutes = Math.max(1, Math.round(targetSeconds / 60));

                const title = messages.quest_name || config.name || application.name || `Quest #${index + 1}`;
                const publisher = messages.game_publisher || messages.quest_publisher || application.name || 'Discord Partner';

                const taskDetails = taskKeys.length > 0
                    ? taskKeys.map(k => `• ${formatTaskName(k)} • **${Math.max(1, Math.round((tasks[k]?.target || targetSeconds) / 60))} min**`)
                    : [`• Play on Desktop • **${durationMinutes} min**`, '• PLAY_ON_XBOX', '• PLAY_ON_PLAYSTATION'];

                const expiresText = formatTimeRemaining(config.expires_at);
                const isExpired = Boolean(config.expires_at && new Date(config.expires_at).getTime() <= Date.now());

                let orbsReward = 700;
                let rewardText = '**700 Orbs ✦** *(700 Orbs)*';
                if (messages.reward_name) {
                    rewardText = `**${messages.reward_name}**`;
                }

                const trafficMetadataSealed = q.traffic_metadata_sealed || config.traffic_metadata_sealed || null;
                const metadataSealed = q.metadata_sealed || config.metadata_sealed || null;

                return {
                    id: String(q.id),
                    number: index + 1,
                    title,
                    publisher,
                    taskDetails,
                    durationMinutes,
                    expiresText,
                    isExpired,
                    orbsReward,
                    rewardText,
                    applicationId: application.id || config.application_id || null,
                    taskType: primaryTaskKey,
                    targetSeconds,
                    trafficMetadataSealed,
                    metadataSealed,
                    enrolled: Boolean(q.user_status?.enrolled_at),
                    completed: Boolean(q.user_status?.completed_at),
                    claimed: Boolean(q.user_status?.claimed_at),
                    currentProgress: q.user_status?.progress?.[primaryTaskKey]?.value || q.user_status?.stream_progress_seconds || 0,
                    raw: q
                };
            });

            // Sort unexpired active quests first
            formattedQuests.sort((a, b) => {
                if (a.isExpired !== b.isExpired) return a.isExpired ? 1 : -1;
                return 0;
            });

            // Re-index clean 1..N order
            formattedQuests.forEach((q, idx) => {
                q.number = idx + 1;
            });

            return {
                success: true,
                status: 200,
                quests: formattedQuests,
                rawQuests: rawList
            };
        } catch (err) {
            console.error(`[DiscordAPI] fetchUserQuests error:`, err.message);
            return { success: false, error: err.message, quests: [], rawQuests: [] };
        }
    }

    /**
     * Enrolls / Accepts an active Discord Quest on user's account safely
     */
    async enrollQuest(token, questId, metadata = {}) {
        try {
            console.log(`[Anti-Ban Protection] Enrolling in quest ID: ${questId}`);
            const body = {
                location: 1
            };
            if (metadata.trafficMetadataSealed) {
                body.traffic_metadata_sealed = metadata.trafficMetadataSealed;
            }
            if (metadata.metadataSealed) {
                body.metadata_sealed = metadata.metadataSealed;
            }

            const enrollRes = await this.safeFetch(`https://discord.com/api/v9/quests/${questId}/enroll`, {
                method: 'POST',
                headers: this.getHeaders(token),
                body: JSON.stringify(body)
            });

            if (enrollRes.ok || enrollRes.status === 204) {
                return { success: true, status: enrollRes.status };
            }

            // Fallback try /accept with slight pause
            await sleep(800);
            const acceptRes = await this.safeFetch(`https://discord.com/api/v9/quests/${questId}/accept`, {
                method: 'POST',
                headers: this.getHeaders(token),
                body: JSON.stringify(body)
            });

            return { success: acceptRes.ok || acceptRes.status === 204, status: acceptRes.status };
        } catch (err) {
            console.error(`[DiscordAPI] enroll error:`, err.message);
            return { success: false, error: err.message };
        }
    }

    /**
     * Sends stream / playtime heartbeat to Discord's Quest endpoint safely
     */
    async sendQuestHeartbeat(token, questId, terminal = false, streamKey = null, metadata = {}) {
        try {
            const body = {
                terminal: Boolean(terminal)
            };
            if (streamKey) {
                body.stream_key = streamKey;
            }
            if (metadata.applicationId) {
                body.application_id = metadata.applicationId;
            }
            if (metadata.trafficMetadataSealed) {
                body.traffic_metadata_sealed = metadata.trafficMetadataSealed;
            }
            if (metadata.metadataSealed) {
                body.metadata_sealed = metadata.metadataSealed;
            }

            console.log(`[Anti-Ban Protection] Transmitting heartbeat: Quest=${questId}, Terminal=${terminal}`);
            const res = await this.safeFetch(`https://discord.com/api/v9/quests/${questId}/heartbeat`, {
                method: 'POST',
                headers: this.getHeaders(token),
                body: JSON.stringify(body)
            });

            if (res.ok || res.status === 204) {
                const data = res.status !== 204 ? await res.json().catch(() => ({})) : {};
                return { success: true, status: res.status, data };
            }

            const errText = await res.text().catch(() => '');
            return { success: false, status: res.status, error: errText };
        } catch (err) {
            console.error(`[DiscordAPI] heartbeat error:`, err.message);
            return { success: false, error: err.message };
        }
    }

    /**
     * Updates video progress for WATCH_VIDEO quests safely
     */
    async sendVideoProgress(token, questId, timestamp = 900, metadata = {}) {
        try {
            console.log(`[Anti-Ban Protection] Transmitting video watch progression: Quest=${questId}, Progress=${timestamp}s`);
            const body = {
                timestamp
            };
            if (metadata.trafficMetadataSealed) {
                body.traffic_metadata_sealed = metadata.trafficMetadataSealed;
            }
            if (metadata.metadataSealed) {
                body.metadata_sealed = metadata.metadataSealed;
            }

            const res = await this.safeFetch(`https://discord.com/api/v9/quests/${questId}/video-progress`, {
                method: 'POST',
                headers: this.getHeaders(token),
                body: JSON.stringify(body)
            });

            if (res.ok || res.status === 204) {
                const data = res.status !== 204 ? await res.json().catch(() => ({})) : {};
                return { success: true, status: res.status, data };
            }

            const errText = await res.text().catch(() => '');
            return { success: false, status: res.status, error: errText };
        } catch (err) {
            console.error(`[DiscordAPI] video-progress error:`, err.message);
            return { success: false, error: err.message };
        }
    }

    /**
     * Attempts to claim quest reward directly via API
     */
    async claimQuestReward(token, questId, metadata = {}) {
        try {
            const body = {
                platform: 0
            };
            if (metadata.trafficMetadataSealed) {
                body.traffic_metadata_sealed = metadata.trafficMetadataSealed;
            }
            if (metadata.metadataSealed) {
                body.metadata_sealed = metadata.metadataSealed;
            }

            const res = await this.safeFetch(`https://discord.com/api/v9/quests/${questId}/claim-reward`, {
                method: 'POST',
                headers: this.getHeaders(token),
                body: JSON.stringify(body)
            });

            if (res.ok || res.status === 204) {
                const data = res.status !== 204 ? await res.json().catch(() => ({})) : {};
                return { success: true, status: res.status, data };
            }
            return { success: false, status: res.status };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Completes a quest using natural pacing & human-timed progression
     */
    async completeQuestOnDiscord(token, quest, options = {}) {
        if (!token || token.startsWith('demo')) {
            return { success: true, demo: true };
        }

        const questId = quest.id;
        const streamKey = options.streamKey || (options.channelId ? `call:${options.channelId}:${options.userId}` : null);
        const metadata = {
            applicationId: quest.applicationId,
            trafficMetadataSealed: quest.trafficMetadataSealed,
            metadataSealed: quest.metadataSealed
        };

        // 1. Enroll quest with anti-cheat metadata
        await this.enrollQuest(token, questId, metadata);
        await sleep(1500, 500); // Realistic delay after enrollment

        // 2. Transmit realistic progress increments
        if (quest.taskType === 'WATCH_VIDEO' || quest.taskType === 'WATCH_VIDEO_ON_MOBILE') {
            const totalSec = quest.targetSeconds || 90;
            const halfSec = Math.round(totalSec * 0.5);

            await this.sendVideoProgress(token, questId, halfSec, metadata);
            await sleep(2000, 800); // Natural delay
            await this.sendVideoProgress(token, questId, totalSec, metadata);
        } else {
            await this.sendQuestHeartbeat(token, questId, false, streamKey, metadata);
            await sleep(2500, 1000); // Natural heartbeat gap
            await this.sendQuestHeartbeat(token, questId, true, streamKey, metadata);
        }

        await sleep(1200, 400);

        // 3. Try claiming reward directly (falls back to Discord App manual claim)
        await this.claimQuestReward(token, questId, metadata).catch(() => {});

        return {
            success: true
        };
    }

    /**
     * Updates HypeSquad house for a user account
     */
    async setHypeSquad(token, houseId) {
        try {
            const res = await this.safeFetch('https://discord.com/api/v9/hypesquad/online', {
                method: 'POST',
                headers: this.getHeaders(token),
                body: JSON.stringify({ house_id: houseId })
            });

            if (res.status === 204 || res.ok) {
                return { success: true };
            }
            return { success: false, status: res.status, error: `Failed to set HypeSquad: ${res.statusText}` };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Removes HypeSquad house badge
     */
    async clearHypeSquad(token) {
        try {
            const res = await this.safeFetch('https://discord.com/api/v9/hypesquad/online', {
                method: 'DELETE',
                headers: this.getHeaders(token)
            });

            if (res.status === 204 || res.ok) {
                return { success: true };
            }
            return { success: false, status: res.status };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
}

const discordApi = new DiscordApiService();
module.exports = discordApi;
