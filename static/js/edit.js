function getApiBaseUrl() {
    return window.location.origin;
}

let currentArticle = null;

const backButton = document.getElementById('backButton');
const updateBtn = document.getElementById('updateBtn');
const titleInput = document.getElementById('titleInput');
const nameInput = document.getElementById('nameInput');
const contentInput = document.getElementById('contentInput');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const loadingMessage = document.getElementById('loadingMessage');
const articleIdElement = document.getElementById('articleId');

backButton.addEventListener('click', handleBack);
updateBtn.addEventListener('click', handleUpdate);

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add('show');
  successMessage.classList.remove('show');
  setTimeout(() => {
    errorMessage.classList.remove('show');
  }, 5000);
}

function showSuccess(message) {
  successMessage.textContent = message;
  successMessage.classList.add('show');
  errorMessage.classList.remove('show');
  setTimeout(() => {
    successMessage.classList.remove('show');
  }, 3000);
}

function showLoading(message) {
  loadingMessage.textContent = message;
  loadingMessage.classList.add('show');
}

function hideLoading() {
  loadingMessage.classList.remove('show');
}

function setLoading(isLoading) {
  if (isLoading) {
    updateBtn.disabled = true;
    updateBtn.textContent = '⋯';
    updateBtn.style.animation = 'spin 1s linear infinite';
  } else {
    updateBtn.disabled = false;
    updateBtn.textContent = 'UPDATE';
    updateBtn.style.animation = '';
  }
}

function getArticleId() {
  const pathParts = window.location.pathname.split('/');
  return pathParts[1];
}

async function loadArticle() {
  const articleId = getArticleId();
  
  if (!articleId) {
    showError('Article ID not found');
    return;
  }

  showLoading('Loading article...');

  try {
    const response = await fetch(`${getApiBaseUrl()}/article/${articleId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        hideLoading();
        showError('Article not found');
        return;
      }
      throw new Error('Failed to load article');
    }
    
    currentArticle = await response.json();

    titleInput.value = currentArticle.title || '';
    nameInput.value = currentArticle.authorName || '';
    nameInput.readOnly = true;
    contentInput.value = currentArticle.content || '';

    articleIdElement.textContent = currentArticle.id;

    document.title = `Edit: ${currentArticle.title || 'Article'} - Krost`;
    
    hideLoading();
  } catch (error) {
    hideLoading();
    showError('Failed to load article');
    console.error('Error loading article:', error);
  }
}

function handleBack() {
  const articleId = getArticleId();
  if (articleId) {
    window.location.href = `/${articleId}`;
  } else {
    window.location.href = '/';
  }
}

async function handleUpdate() {
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  if (!title) {
    showError('Please enter a title');
    titleInput.focus();
    return;
  }

  if (!content) {
    showError('Please enter some content');
    contentInput.focus();
    return;
  }

  if (!currentArticle) {
    showError('No article to update');
    return;
  }

  setLoading(true);

  try {
    const article = {
      title: title,
      content: content,
    };

    const headers = {
      'Content-Type': 'application/json',
    };

    const token = localStorage.getItem('authToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${getApiBaseUrl()}/article/${currentArticle.id}`, {
      method: 'PUT',
      headers: headers,
      body: JSON.stringify(article),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update article');
    }

    const result = await response.json();
    
    showSuccess('Article updated successfully!');

    setTimeout(() => {
      window.location.href = `/${currentArticle.id}`;
    }, 1500);

  } catch (error) {
    console.error('Update error:', error);
    showError(error.message || 'Failed to update article');
  } finally {
    setLoading(false);
  }
}

async function init() {
  await loadArticle();
}

window.addEventListener('load', init); 