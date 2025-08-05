const articleTitle = document.getElementById('articleTitle');
const authorName = document.getElementById('authorName');
const publishDate = document.getElementById('publishDate');
const articleContent = document.getElementById('articleContent');
const editButton = document.getElementById('editButton');
const updatedInfo = document.getElementById('updatedInfo');
const updatedDate = document.getElementById('updatedDate');
const reportLink = document.getElementById('reportLink');

async function getArticleData() {
  const pathParts = window.location.pathname.split('/');
  const articleId = pathParts[1];
  
  if (!articleId) {
    return null;
  }

  try {
    const response = await fetch(`http://localhost:5001/article/${articleId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to fetch article');
    }
    
    const article = await response.json();

    return {
      id: article.id,
      title: article.title,
      content: article.content,
      authorName: article.authorName,
      authorHandle: article.authorHandle,
      publishDate: article.createdAt,
      updatedDate: article.updatedAt
    };
  } catch (error) {
    console.error('Error fetching article:', error);
    return null;
  }
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

  if (article.authorHandle) {
    const displayName = article.authorName;
    const username = article.authorHandle;
    authorName.innerHTML = `${displayName} <span style="color: #777; font-weight: normal;">(@${username})</span>`;
    authorName.className = 'logged-in-author';
  } else {
    const author = article.authorName || 'Anonymous';
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
  const authToken = localStorage.getItem('authToken');
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

  if (authToken && currentUser && currentUser.username === article.authorHandle) {
    editButton.classList.add('show');
    editButton.href = `/${article.id}/edit`;
  } else {
    editButton.classList.remove('show');
  }
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
  const pathParts = window.location.pathname.split('/');
  return pathParts[1];
}

reportLink.addEventListener('click', handleReport);

async function init() {
  const article = await getArticleData();
  displayArticle(article);
}

window.addEventListener('load', init); 