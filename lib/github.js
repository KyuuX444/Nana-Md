const axios = require('axios');
const fs = require('fs');

function ghHeaders(token) {
    return {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'KyuuBot/1.0'
    };
}

async function ghRequest(method, endpoint, token, data = null, extraHeaders = {}) {
    const res = await axios({
        method,
        url: `https://api.github.com${endpoint}`,
        headers: { ...ghHeaders(token), ...extraHeaders },
        data,
        validateStatus: () => true
    });
    return res;
}

async function getUsername(token) {
    const res = await ghRequest('GET', '/user', token);
    if (res.status !== 200) throw new Error('Token tidak valid atau tidak bisa fetch user.');
    return res.data.login;
}

async function createRepo(token, repoName, isPrivate = false, description = '') {
    const res = await ghRequest('POST', '/user/repos', token, {
        name: repoName,
        private: isPrivate,
        description,
        auto_init: true
    });
    if (res.status === 201) return { success: true, data: res.data };
    if (res.status === 422) return { success: false, error: 'Repo sudah ada atau nama tidak valid.' };
    return { success: false, error: res.data?.message || 'Gagal buat repo.' };
}

async function deleteRepo(token, username, repoName) {
    const res = await ghRequest('DELETE', `/repos/${username}/${repoName}`, token);
    if (res.status === 204) return { success: true };
    if (res.status === 404) return { success: false, error: 'Repo tidak ditemukan.' };
    if (res.status === 403) return { success: false, error: 'Tidak punya izin hapus repo ini.' };
    return { success: false, error: res.data?.message || 'Gagal hapus repo.' };
}

async function listRepos(token, username, page = 1) {
    const res = await ghRequest('GET', `/users/${username}/repos?per_page=20&page=${page}&sort=updated`, token);
    if (res.status !== 200) return { success: false, error: 'Gagal ambil daftar repo.' };
    return { success: true, data: res.data };
}

async function getRepoInfo(token, username, repoName) {
    const res = await ghRequest('GET', `/repos/${username}/${repoName}`, token);
    if (res.status === 404) return { success: false, error: 'Repo tidak ditemukan.' };
    if (res.status !== 200) return { success: false, error: res.data?.message || 'Gagal ambil info repo.' };
    return { success: true, data: res.data };
}

async function createRelease(token, username, repoName, tagName, releaseName, body = '', draft = false, prerelease = false) {
    const res = await ghRequest('POST', `/repos/${username}/${repoName}/releases`, token, {
        tag_name: tagName,
        name: releaseName,
        body,
        draft,
        prerelease
    });
    if (res.status === 201) return { success: true, data: res.data };
    return { success: false, error: res.data?.message || 'Gagal buat release.' };
}

async function uploadReleaseAsset(token, uploadUrl, filePath, fileName) {
    const fileBuffer = fs.readFileSync(filePath);
    // Pastikan URL mengarah ke uploads.github.com
    let cleanUrl = uploadUrl.replace('{?name,label}', '');
    if (cleanUrl.includes('api.github.com')) {
        cleanUrl = cleanUrl.replace('api.github.com', 'uploads.github.com');
    }

    const res = await axios({
        method: 'POST',
        url: `${cleanUrl}?name=${encodeURIComponent(fileName)}`,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/octet-stream',
            'User-Agent': 'KyuuBot/1.0'
        },
        data: fileBuffer,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        validateStatus: () => true
    });
    if (res.status === 201) return { success: true, data: res.data };
    return { success: false, error: res.data?.message || 'Gagal upload asset.' };
}


async function pushFileToRepo(token, username, repoName, filePath, commitMessage, targetPath, branch = 'main') {
    const fileBuffer = fs.readFileSync(filePath);
    const content = fileBuffer.toString('base64');
    let sha = null;
    const checkRes = await ghRequest('GET', `/repos/${username}/${repoName}/contents/${targetPath}?ref=${branch}`, token);
    if (checkRes.status === 200) sha = checkRes.data.sha;
    const res = await ghRequest('PUT', `/repos/${username}/${repoName}/contents/${targetPath}`, token, {
        message: commitMessage,
        content,
        branch,
        ...(sha ? { sha } : {})
    });
    if (res.status === 201 || res.status === 200) return { success: true, data: res.data };
    return { success: false, error: res.data?.message || 'Gagal push file.' };
}

module.exports = {
    getUsername,
    createRepo,
    deleteRepo,
    listRepos,
    getRepoInfo,
    createRelease,
    uploadReleaseAsset,
    pushFileToRepo
};
