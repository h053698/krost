// AI 도구 기능 관리
document.addEventListener('DOMContentLoaded', function() {
    const aiToolsBtn = document.getElementById('aiToolsBtn');
    const aiToolsMenu = document.getElementById('aiToolsMenu');
    const fixGrammarOption = document.getElementById('fixGrammarOption');

    // AI 도구 버튼 클릭 시 메뉴 토글
    aiToolsBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        aiToolsMenu.classList.toggle('show');
    });

    // 메뉴 외부 클릭 시 메뉴 닫기
    document.addEventListener('click', function(e) {
        if (!aiToolsBtn.contains(e.target) && !aiToolsMenu.contains(e.target)) {
            aiToolsMenu.classList.remove('show');
        }
    });

    // Fix Grammar with AI 옵션 클릭
    fixGrammarOption.addEventListener('click', function() {
        aiToolsMenu.classList.remove('show');
        handleFixGrammar();
    });

    // AI 도구 버튼에 로딩 상태 추가
    function setAIToolsLoading(isLoading) {
        const aiToolsBtn = document.getElementById('aiToolsBtn');
        if (isLoading) {
            aiToolsBtn.textContent = '⋯';
            aiToolsBtn.style.animation = 'ai-spin 1s linear infinite';
            aiToolsBtn.disabled = true;
        } else {
            aiToolsBtn.textContent = '+';
            aiToolsBtn.style.animation = '';
            aiToolsBtn.disabled = false;
        }
    }

    // 문법 수정 기능
    async function handleFixGrammar() {
        const contentInput = document.querySelector('.content-input') || document.getElementById('contentInput');
        if (!contentInput) {
            console.error('Content input not found');
            return;
        }

        const content = contentInput.value.trim();
        if (!content) {
            alert('Please enter some content to fix grammar.');
            return;
        }

        // 로딩 상태 표시
        const originalContent = contentInput.value;
        contentInput.disabled = true;
        contentInput.style.opacity = '0.6';
        contentInput.style.transition = 'opacity 0.3s ease';
        setAIToolsLoading(true);
        
        try {
            const response = await fetch('https://ai.hackclub.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'user',
                            content: `Fix the grammar in this text. Only output the corrected text without any additional comments: ${content}`
                        }
                    ],
                    temperature: 0.1,
                    max_completion_tokens: 2000,
                    reasoning_format: 'hidden',
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const fixedContent = data.choices[0].message.content.trim();

            // 애니메이션으로 내용 변경
            await animateContentChange(contentInput, originalContent, fixedContent);
            
        } catch (error) {
            console.error('Grammar fix failed:', error);
            alert('Failed to fix grammar. Please try again.');
            
            // 에러 시 원래 상태로 복원
            contentInput.value = originalContent;
        } finally {
            // 로딩 상태 해제
            contentInput.disabled = false;
            contentInput.style.opacity = '1';
            setAIToolsLoading(false);
        }
    }

    // 내용 변경 애니메이션
    async function animateContentChange(element, oldContent, newContent) {
        return new Promise((resolve) => {
            // 페이드 아웃
            element.style.transition = 'opacity 0.3s ease';
            element.style.opacity = '0.3';
            
            setTimeout(() => {
                // 내용 변경
                element.value = newContent;
                
                // 페이드 인
                element.style.opacity = '1';
                
                setTimeout(() => {
                    resolve();
                }, 300);
            }, 300);
        });
    }


}); 