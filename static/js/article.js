const articleTitle = document.getElementById('articleTitle');
const authorName = document.getElementById('authorName');
const publishDate = document.getElementById('publishDate');
const articleContent = document.getElementById('articleContent');
const editButton = document.getElementById('editButton');
const updatedInfo = document.getElementById('updatedInfo');
const updatedDate = document.getElementById('updatedDate');
const reportLink = document.getElementById('reportLink');

function getArticleData() {
  const urlParams = new URLSearchParams(window.location.search);
  const articleId = urlParams.get('id');
  
  if (articleId) {
    const savedArticle = localStorage.getItem(`article_${articleId}`);
    if (savedArticle) {
      return JSON.parse(savedArticle);
    }
  }

  const articles = JSON.parse(localStorage.getItem('articles') || '[]');
  if (articles.length > 0) {
    return articles[articles.length - 1];
  }
  
  return null;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now - date) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
}

function displayArticle(article) {
  if (!article) {
    articleTitle.textContent = 'Article Not Found';
    articleContent.textContent = 'The article you are looking for does not exist.';
    return;
  }

  articleTitle.textContent = article.title || 'Untitled';

  if (article.isLoggedIn && article.verifiedUser) {
    const displayName = article.verifiedUser.displayName;
    const username = article.verifiedUser.username;
    authorName.innerHTML = `${displayName} <span style="color: #777; font-weight: normal;">(@${username})</span>`;
    authorName.className = 'logged-in-author';
  } else {
    const author = article.author || 'Anonymous';
    if (author === 'Anonymous') {
      authorName.textContent = 'Anonymous';
      authorName.className = 'anonymous-author';
    } else {
      authorName.textContent = author;
      authorName.className = 'anonymous-author';
    }
  }
  
  publishDate.textContent = formatDate(article.publishDate || new Date().toISOString());
  articleContent.innerHTML = article.content || 'No content available.';

  if (article.updatedDate) {
    updatedDate.textContent = formatDate(article.updatedDate);
    updatedInfo.classList.add('show');
  } else {
    updatedInfo.classList.remove('show');
  }

  document.title = `${article.title || 'Article'} - Krost`;
  checkEditPermission(article);
}

function checkEditPermission(article) {
  editButton.classList.add('show');
  editButton.href = `/edit.html?id=${article.id}`;
}

function handleReport() {
  const articleId = getArticleId();
  const reportData = {
    articleId: articleId,
    reportedAt: new Date().toISOString(),
    reason: 'User reported this article'
  };

  const reports = JSON.parse(localStorage.getItem('reports') || '[]');
  reports.push(reportData);
  localStorage.setItem('reports', JSON.stringify(reports));

  reportLink.textContent = 'Reported';
  reportLink.classList.add('reported');
  reportLink.style.pointerEvents = 'none';
  
  setTimeout(() => {
    reportLink.textContent = 'Report this article';
    reportLink.classList.remove('reported');
    reportLink.style.pointerEvents = 'auto';
  }, 3000);
}

function getArticleId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
}

reportLink.addEventListener('click', handleReport);

function init() {
  const article = getArticleData();
  displayArticle(article);
}

window.addEventListener('load', init); 