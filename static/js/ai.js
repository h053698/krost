document.addEventListener('DOMContentLoaded', function() {
    const aiToolsButton = document.getElementById('aiToolsButton');
    const aiToolsMenu = document.getElementById('aiToolsMenu');
    const fixGrammarOption = document.getElementById('fixGrammarOption');
    const businessToneOption = document.getElementById('businessToneOption');

    aiToolsButton.addEventListener('click', function(e) {
        e.stopPropagation();
        aiToolsMenu.classList.toggle('show');
    });

    document.addEventListener('click', function(e) {
        if (!aiToolsButton.contains(e.target) && !aiToolsMenu.contains(e.target)) {
            aiToolsMenu.classList.remove('show');
        }
    });

    fixGrammarOption.addEventListener('click', function() {
        aiToolsMenu.classList.remove('show');
        setAiToolsLoading(true);
        handleFixGrammar();
    });

    businessToneOption.addEventListener('click', function() {
        aiToolsMenu.classList.remove('show');
        setAiToolsLoading(true);
        handleBusinessTone();
    });

    function setAiToolsLoading(isLoading) {
        const aiToolsButton = document.getElementById('aiToolsButton');
        if (isLoading) {
            aiToolsButton.textContent = '⋯';
            aiToolsButton.style.animation = 'ai-spin 1s linear infinite';
            aiToolsButton.disabled = true;
        } else {
            aiToolsButton.textContent = '+';
            aiToolsButton.style.animation = '';
            aiToolsButton.disabled = false;
        }
    }

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

        const originalContent = contentInput.value;
        contentInput.disabled = true;
        contentInput.style.opacity = '0.6';
        contentInput.style.transition = 'opacity 0.3s ease';
        
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
                            content: `Fix the grammar in this text. Only output the corrected text without any additional comments. Please respond in the same language as the input text: ${content}`
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

            await animateContentChange(contentInput, originalContent, fixedContent);
            
        } catch (error) {
            console.error('Grammar fix failed:', error);
            alert('Failed to fix grammar. Please try again.');
            contentInput.value = originalContent;
        } finally {
            contentInput.disabled = false;
            contentInput.style.opacity = '1';
            setAiToolsLoading(false);
        }
    }

    async function handleBusinessTone() {
        const contentInput = document.querySelector('.content-input') || document.getElementById('contentInput');
        if (!contentInput) {
            console.error('Content input not found');
            return;
        }

        const content = contentInput.value.trim();
        if (!content) {
            alert('Please enter some content to convert to business tone.');
            return;
        }

        const originalContent = contentInput.value;
        contentInput.disabled = true;
        contentInput.style.opacity = '0.6';
        contentInput.style.transition = 'opacity 0.3s ease';
        
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
                            content: `Convert this text to a formal business tone. Make it professional and respectful while maintaining the original meaning. Only output the converted text without any additional comments. Please respond in the same language as the input text: ${content}`
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
            const businessContent = data.choices[0].message.content.trim();

            await animateContentChange(contentInput, originalContent, businessContent);
            
        } catch (error) {
            console.error('Business tone conversion failed:', error);
            alert('Failed to convert to business tone. Please try again.');
            contentInput.value = originalContent;
        } finally {
            contentInput.disabled = false;
            contentInput.style.opacity = '1';
            setAiToolsLoading(false);
        }
    }

    async function animateContentChange(element, oldContent, newContent) {
        return new Promise((resolve) => {
            element.style.transition = 'opacity 0.3s ease';
            element.style.opacity = '0.3';
            
            setTimeout(() => {
                element.value = newContent;
                element.style.opacity = '1';
                
                setTimeout(() => {
                    resolve();
                }, 300);
            }, 300);
        });
    }
}); 