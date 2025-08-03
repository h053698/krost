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
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
}

function loadArticle() {
  const articleId = getArticleId();
  
  if (!articleId) {
    showError('Article ID not found');
    return;
  }

  showLoading('Loading article...');

  const savedArticle = localStorage.getItem(`article_${articleId}`);
  
  if (!savedArticle) {
    hideLoading();
    showError('Article not found');
    return;
  }

  try {
    currentArticle = JSON.parse(savedArticle);

    titleInput.value = currentArticle.title || '';
    nameInput.value = currentArticle.author || '';
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
    window.location.href = `/article.html?id=${articleId}`;
  } else {
    window.location.href = '/';
  }
}

function handleUpdate() {
  const title = titleInput.value.trim();
  const author = nameInput.value.trim();
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
    const updatedArticle = {
      ...currentArticle,
      title: title,
      author: author || 'Anonymous',
      content: content,
      updatedDate: new Date().toISOString()
    };

    localStorage.setItem(`article_${currentArticle.id}`, JSON.stringify(updatedArticle));

    const articles = JSON.parse(localStorage.getItem('articles') || '[]');
    const articleIndex = articles.findIndex(article => article.id === currentArticle.id);
    
    if (articleIndex !== -1) {
      articles[articleIndex] = updatedArticle;
      localStorage.setItem('articles', JSON.stringify(articles));
    }

    showSuccess('Article updated successfully!');

    setTimeout(() => {
      window.location.href = `/article.html?id=${currentArticle.id}`;
    }, 1500);

  } catch (error) {
    console.error('Error updating article:', error);
    showError('Failed to update article');
  } finally {
    setLoading(false);
  }
}

function init() {
  loadArticle();
}

window.addEventListener('load', init); 