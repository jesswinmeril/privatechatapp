// my_flask_app/app/static/api.js

const BASE_URL = window.location.origin;

/**
 * Makes a fetch call with automatic access token refresh.
 * @param {string} url - The endpoint URL (absolute or relative).
 * @param {Object} options - Fetch options { method, headers, body }.
 * @param {boolean} retried - Internal flag to avoid infinite retries.
 * @returns {Promise<Object>} - Resolves to response JSON object.
 */
export async function apiFetchWithRefresh(url, options = {}, retried = false) {
    if (!options.headers) {
        options.headers = {};
    }

    const accessToken = localStorage.getItem('access_token');
    if (accessToken) {
        options.headers['Authorization'] = `Bearer ${accessToken}`;
    }

    try {
        const response = await fetch(url.startsWith('http') ? url : `${BASE_URL}${url}`, options);

        // If unauthorized or validation error, try refreshing token once
        if ((response.status === 401 || response.status === 422) && !retried) {
            const refreshToken = localStorage.getItem('refresh_token');
            if (!refreshToken) {
                throw new Error('Missing refresh token');
            }

            const refreshResponse = await fetch(`${BASE_URL}/token/refresh`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${refreshToken}`,
                    'Content-Type': 'application/json',
                },
            });

            const refreshData = await refreshResponse.json();
            if (refreshData.access_token) {
                localStorage.setItem('access_token', refreshData.access_token);
                // Retry original request with new token
                options.headers['Authorization'] = `Bearer ${refreshData.access_token}`;
                const retryResponse = await fetch(url.startsWith('http') ? url : `${BASE_URL}${url}`, options);
                return retryResponse.json().catch(() => ({}));
            } else {
                throw new Error('Token refresh failed');
            }
        }

        return response.json().catch(() => ({}));
    } catch (error) {
        // Optionally handle/log errors here or rethrow
        throw error;
    }
}

export function getAccessToken() {
    return localStorage.getItem('access_token');
}

export function getRefreshToken() {
    return localStorage.getItem('refresh_token');
}
