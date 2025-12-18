/**
 * Tweet Scheduler - Frontend App
 */

// Global state
let currentSection = 'dashboard';
let loginModal = null;

// ==============================================================================
// INITIALIZATION
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Bootstrap modal
    loginModal = new bootstrap.Modal(document.getElementById('loginModal'));

    // Check authentication
    checkAuth();

    // Setup event listeners
    setupEventListeners();

    // Setup routing
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
});

// ==============================================================================
// AUTHENTICATION
// ==============================================================================

async function checkAuth() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();

        if (data.authenticated) {
            showApp();
            loadDashboard();
        } else {
            showLogin();
        }
    } catch (error) {
        console.error('Error checking auth:', error);
        showLogin();
    }
}

function showLogin() {
    document.getElementById('app').classList.add('d-none');
    loginModal.show();
}

function showApp() {
    loginModal.hide();
    document.getElementById('app').classList.remove('d-none');
}

// Login form handler
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('loginPassword').value;
        await login(password);
    });

    // Upload form
    document.getElementById('uploadForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('fileInput');
        if (fileInput.files.length > 0) {
            await uploadFile(fileInput.files[0]);
        }
    });

    // Credentials form
    document.getElementById('credentialsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveCredentials();
    });

    // Filter tweets
    document.getElementById('filterStatus').addEventListener('change', () => {
        loadTweets();
    });

    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const hash = e.target.closest('a').getAttribute('href');
            window.location.hash = hash;
        });
    });
}

async function login(password) {
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (data.success) {
            showApp();
            loadDashboard();
        } else {
            showError('loginError', data.error || 'Password incorrecto');
        }
    } catch (error) {
        showError('loginError', 'Error al conectar con el servidor');
    }
}

async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.reload();
    } catch (error) {
        console.error('Error logging out:', error);
        window.location.reload();
    }
}

// ==============================================================================
// ROUTING
// ==============================================================================

function handleRoute() {
    const hash = window.location.hash.slice(1) || 'dashboard';

    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('d-none');
    });

    // Remove active from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Show current section
    const section = document.getElementById(`section-${hash}`);
    if (section) {
        section.classList.remove('d-none');
        currentSection = hash;

        // Set active nav
        const navLink = document.getElementById(`nav-${hash}`);
        if (navLink) navLink.classList.add('active');

        // Load data for section
        switch (hash) {
            case 'dashboard':
                loadDashboard();
                break;
            case 'tweets':
                loadTweets();
                break;
            case 'settings':
                loadCredentials();
                break;
            case 'upload':
                // Redirect to tweets section (now unified)
                window.location.hash = 'tweets';
                break;
        }
    }
}

// ==============================================================================
// DASHBOARD
// ==============================================================================

async function loadDashboard() {
    try {
        const response = await fetch('/api/dashboard/stats');
        const data = await response.json();

        if (data.success) {
            const stats = data.stats;

            // API Counter
            document.getElementById('apiCount').textContent =
                `${stats.apiCalls.calls_count} / ${stats.apiCalls.monthly_limit}`;
            document.getElementById('apiMonth').textContent =
                `Mes: ${stats.apiCalls.month}`;

            const percentage = stats.apiCalls.percentage;
            const progressBar = document.getElementById('apiProgress');
            progressBar.style.width = `${percentage}%`;
            progressBar.textContent = `${percentage}%`;

            // Color del progress bar
            progressBar.className = 'progress-bar';
            if (percentage >= 90) {
                progressBar.classList.add('bg-danger');
            } else if (percentage >= 70) {
                progressBar.classList.add('bg-warning');
            } else {
                progressBar.classList.add('bg-success');
            }

            // Tweet stats
            document.getElementById('pendingCount').textContent = stats.pendingCount;
            document.getElementById('publishedToday').textContent = stats.publishedToday;

            // Recent tweets
            renderRecentTweets(stats.recentTweets);
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showAlert('danger', 'Error al cargar el dashboard');
    }
}

function renderRecentTweets(tweets) {
    const container = document.getElementById('recentTweets');

    if (!tweets || tweets.length === 0) {
        container.innerHTML = '<p class="text-muted">No hay tweets publicados recientemente</p>';
        return;
    }

    const html = `
        <table class="table table-sm">
            <thead>
                <tr>
                    <th>Texto</th>
                    <th>Thread</th>
                    <th>Publicado</th>
                    <th>Link</th>
                </tr>
            </thead>
            <tbody>
                ${tweets.map(tweet => `
                    <tr>
                        <td>${truncate(tweet.texto, 50)}</td>
                        <td>${tweet.thread_id || '-'}</td>
                        <td>${formatDate(tweet.published_at)}</td>
                        <td>
                            ${tweet.tweet_id ?
                                `<a href="https://twitter.com/i/web/status/${tweet.tweet_id}" target="_blank" class="btn btn-sm btn-outline-primary">
                                    <i class="bi bi-box-arrow-up-right"></i>
                                </a>` :
                                '-'
                            }
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

// ==============================================================================
// UPLOAD
// ==============================================================================

async function uploadFile(file) {
    const resultDiv = document.getElementById('uploadResult');
    resultDiv.innerHTML = '<div class="alert alert-info">Procesando archivo...</div>';

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    <h6>✓ Archivo procesado exitosamente</h6>
                    <p class="mb-0">
                        <strong>${data.data.totalTweets}</strong> tweets cargados<br>
                        <strong>${data.data.threadsCount}</strong> threads<br>
                        <strong>${data.data.individualTweets}</strong> tweets individuales
                    </p>
                </div>
            `;

            // Reset form
            document.getElementById('uploadForm').reset();

            // Reload dashboard
            setTimeout(() => loadDashboard(), 1000);
        } else {
            resultDiv.innerHTML = `
                <div class="alert alert-danger">
                    <strong>Error:</strong> ${data.error}
                </div>
            `;
        }
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                <strong>Error:</strong> ${error.message}
            </div>
        `;
    }
}

// ==============================================================================
// TWEETS
// ==============================================================================

async function loadTweets() {
    const container = document.getElementById('tweetsList');
    const filter = document.getElementById('filterStatus').value;

    container.innerHTML = '<p class="text-muted">Cargando tweets...</p>';

    try {
        const url = filter ? `/api/tweets?estado=${filter}&limit=100` : '/api/tweets?limit=100';
        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            renderTweetsList(data.data);
        } else {
            container.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
        }
    } catch (error) {
        container.innerHTML = `<div class="alert alert-danger">Error al cargar tweets</div>`;
    }
}

function renderTweetsList(tweets) {
    const container = document.getElementById('tweetsList');

    if (tweets.length === 0) {
        container.innerHTML = '<p class="text-muted">No hay tweets con este filtro</p>';
        return;
    }

    const html = `
        <table class="table table-hover">
            <thead>
                <tr>
                    <th>Texto</th>
                    <th>Thread</th>
                    <th>Fecha Programada</th>
                    <th>Estado</th>
                    <th>Imagen</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${tweets.map(tweet => `
                    <tr>
                        <td>
                            <span class="tweet-text-preview" onclick="showTweetDetails('${tweet.id}')" style="cursor: pointer; color: #1da1f2;">
                                ${truncate(tweet.texto, 60)}
                            </span>
                        </td>
                        <td>${tweet.thread_id || '-'}</td>
                        <td>${formatDate(tweet.fecha_publicacion)}</td>
                        <td>${renderStatus(tweet.estado)}</td>
                        <td>${tweet.imagen_url ? '<i class="bi bi-image text-success"></i>' : '-'}</td>
                        <td>
                            ${tweet.estado === 'pending' ?
                                `<button class="btn btn-sm btn-primary" onclick="publishTweetNow('${tweet.id}')" title="Publicar ahora">
                                    <i class="bi bi-send"></i> Subir Tweet
                                </button>` :
                                tweet.tweet_id ?
                                    `<a href="https://twitter.com/i/web/status/${tweet.tweet_id}" target="_blank" class="btn btn-sm btn-outline-primary" title="Ver en X">
                                        <i class="bi bi-box-arrow-up-right"></i>
                                    </a>` :
                                    '-'
                            }
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <p class="text-muted mt-2">Mostrando ${tweets.length} tweets</p>
    `;

    container.innerHTML = html;
}

function renderStatus(estado) {
    const badges = {
        'pending': '<span class="badge bg-warning">Pendiente</span>',
        'published': '<span class="badge bg-success">Publicado</span>',
        'failed': '<span class="badge bg-danger">Fallido</span>'
    };
    return badges[estado] || estado;
}

/**
 * Publicar un tweet manualmente (inmediatamente)
 */
async function publishTweetNow(tweetId) {
    if (!confirm('¿Estás seguro de que quieres publicar este tweet ahora? Esto consumirá 1 llamada de la API de X.')) {
        return;
    }

    try {
        const response = await fetch(`/api/tweets/${tweetId}/publish`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            showAlert('success', `Tweet publicado exitosamente!<br><a href="${data.data.url}" target="_blank" class="text-white">Ver en X</a>`);

            // Recargar lista de tweets y dashboard
            await loadTweets();
            await loadDashboard();
        } else {
            showAlert('danger', `Error al publicar: ${data.error}`);
        }
    } catch (error) {
        console.error('Error publishing tweet:', error);
        showAlert('danger', `Error al publicar: ${error.message}`);
    }
}

/**
 * Mostrar detalles completos de un tweet en un modal
 */
async function showTweetDetails(tweetId) {
    try {
        const response = await fetch(`/api/tweets/${tweetId}`);
        const data = await response.json();

        if (data.success) {
            const tweet = data.data;
            const content = document.getElementById('tweetDetailsContent');

            content.innerHTML = `
                <div class="tweet-details">
                    <div class="mb-3">
                        <strong>Texto completo:</strong>
                        <p class="mt-2" style="white-space: pre-wrap; word-wrap: break-word;">${tweet.texto}</p>
                        <small class="text-muted">${tweet.texto.length} caracteres</small>
                    </div>

                    ${tweet.thread_id ? `
                        <div class="mb-3">
                            <strong>Thread ID:</strong>
                            <p class="mt-1">${tweet.thread_id}</p>
                        </div>
                    ` : ''}

                    <div class="mb-3">
                        <strong>Fecha programada:</strong>
                        <p class="mt-1">${formatDate(tweet.fecha_publicacion)}</p>
                    </div>

                    <div class="mb-3">
                        <strong>Estado:</strong>
                        <p class="mt-1">${renderStatus(tweet.estado)}</p>
                    </div>

                    ${tweet.imagen_url ? `
                        <div class="mb-3">
                            <strong>Imagen:</strong>
                            <p class="mt-1">
                                <a href="${tweet.imagen_url}" target="_blank" class="btn btn-sm btn-outline-primary">
                                    <i class="bi bi-image"></i> Ver imagen
                                </a>
                            </p>
                        </div>
                    ` : ''}

                    ${tweet.tweet_id ? `
                        <div class="mb-3">
                            <strong>Publicado en X:</strong>
                            <p class="mt-1">
                                <a href="https://twitter.com/i/web/status/${tweet.tweet_id}" target="_blank" class="btn btn-sm btn-primary">
                                    <i class="bi bi-twitter"></i> Ver en X
                                </a>
                            </p>
                        </div>
                    ` : ''}

                    ${tweet.error_message ? `
                        <div class="mb-3">
                            <strong>Error:</strong>
                            <p class="mt-1 text-danger">${tweet.error_message}</p>
                        </div>
                    ` : ''}

                    <div class="mb-0">
                        <strong>Creado:</strong>
                        <p class="mt-1"><small class="text-muted">${formatDate(tweet.created_at)}</small></p>
                    </div>
                </div>
            `;

            // Mostrar el modal
            const modal = new bootstrap.Modal(document.getElementById('tweetDetailsModal'));
            modal.show();
        } else {
            showAlert('danger', `Error al cargar detalles: ${data.error}`);
        }
    } catch (error) {
        console.error('Error loading tweet details:', error);
        showAlert('danger', `Error al cargar detalles: ${error.message}`);
    }
}

// ==============================================================================
// SETTINGS
// ==============================================================================

async function loadCredentials() {
    try {
        const response = await fetch('/api/settings/credentials');
        const data = await response.json();

        if (data.success && data.exists) {
            const info = document.getElementById('credentialsInfo');
            info.classList.remove('d-none');
            info.innerHTML = `
                <strong>Credenciales guardadas:</strong><br>
                API Key: ${data.credentials.api_key}<br>
                Última actualización: ${formatDate(data.credentials.updated_at)}
            `;
        }
    } catch (error) {
        console.error('Error loading credentials:', error);
    }
}

async function saveCredentials() {
    const resultDiv = document.getElementById('credentialsResult');
    resultDiv.innerHTML = '<div class="alert alert-info">Guardando...</div>';

    try {
        const credentials = {
            api_key: document.getElementById('apiKey').value,
            api_secret: document.getElementById('apiSecret').value,
            access_token: document.getElementById('accessToken').value,
            access_token_secret: document.getElementById('accessTokenSecret').value
        };

        const response = await fetch('/api/settings/credentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });

        const data = await response.json();

        if (data.success) {
            resultDiv.innerHTML = '<div class="alert alert-success">✓ Credenciales guardadas exitosamente</div>';
            setTimeout(() => loadCredentials(), 1000);
        } else {
            resultDiv.innerHTML = `<div class="alert alert-danger">Error: ${data.error}</div>`;
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
}

async function testConnection() {
    const resultDiv = document.getElementById('credentialsResult');
    resultDiv.innerHTML = '<div class="alert alert-info">Probando conexión...</div>';

    try {
        const credentials = {
            api_key: document.getElementById('apiKey').value,
            api_secret: document.getElementById('apiSecret').value,
            access_token: document.getElementById('accessToken').value,
            access_token_secret: document.getElementById('accessTokenSecret').value
        };

        const response = await fetch('/api/settings/test-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });

        const data = await response.json();

        if (data.success) {
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    <strong>✓ Conexión exitosa</strong><br>
                    Usuario: @${data.user.username}<br>
                    Nombre: ${data.user.name}
                </div>
            `;
        } else {
            resultDiv.innerHTML = `<div class="alert alert-danger">Error: ${data.error}</div>`;
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
}

// ==============================================================================
// UTILITY FUNCTIONS
// ==============================================================================

function showError(elementId, message) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    el.classList.remove('d-none');
    setTimeout(() => el.classList.add('d-none'), 5000);
}

function showAlert(type, message) {
    // Simple alert at top of page
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alert.style.zIndex = '9999';
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alert);
    setTimeout(() => alert.remove(), 5000);
}

function truncate(str, length) {
    if (!str) return '';
    return str.length > length ? str.substring(0, length) + '...' : str;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}
