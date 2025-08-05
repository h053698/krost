function getApiBaseUrl() {
    return window.location.origin;
}

const publishBtn = document.getElementById('publishBtn');
const titleInput = document.querySelector('.title-input');
const nameInput = document.querySelector('.name-input');
const contentInput = document.querySelector('.content-input');

publishBtn.addEventListener('click', handlePublish);

async function handlePublish() {
    const title = titleInput.value.trim();
    const author = nameInput.value.trim();
    const content = contentInput.value.trim();

    if (!title) {
        window.auth.showError('Please enter a title');
        titleInput.focus();
        return;
    }

    if (!content) {
        window.auth.showError('Please enter some content');
        contentInput.focus();
        return;
    }

    publishBtn.disabled = true;
    publishBtn.textContent = 'Publishing...';

    try {
        const article = {
            title: title,
            authorName: author || 'Anonymous',
            content: content,
        };

        const headers = {
            'Content-Type': 'application/json',
        };

        if (window.auth.isLoggedIn()) {
            const token = window.auth.getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        const response = await fetch(`${getApiBaseUrl()}/article`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(article),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to publish article');
        }

        const result = await response.json();
        
        showSuccess('Article published successfully!');

        titleInput.value = '';
        nameInput.value = '';
        contentInput.value = '';

        setTimeout(() => {
            window.location.href = `/${result.articleId}`;
        }, 1500);

    } catch (error) {
        console.error('Publish error:', error);
        window.auth.showError(error.message || 'Failed to publish article');
    } finally {
        publishBtn.disabled = false;
        publishBtn.textContent = 'PUBLISH';
    }
}

function showSuccess(message) {
    let successMessage = document.getElementById('successMessage');
    if (!successMessage) {
        successMessage = document.createElement('div');
        successMessage.id = 'successMessage';
        successMessage.className = 'error-message';
        successMessage.style.color = '#27ae60';
        document.querySelector('.editor').insertBefore(successMessage, document.querySelector('.title-input'));
    }

    successMessage.textContent = message;
    successMessage.classList.add('show');
    setTimeout(() => {
        successMessage.classList.remove('show');
    }, 3000);
} 