// Coze AI Configuration
const COZE_API_KEY = 'pat_2R3oaaWVgYYzwl6fE17d4TUXI7Vrj2axBHAq9itiSvaQCSfDRdP1TB6EUxK17xBC';
const COZE_BOT_ID = '7446605387228397603';
const COZE_API_URL = 'https://api.coze.cn/open_api/v2/chat';

// Delay the plugin initialization to reduce page load impact
window.addEventListener('load', () => {
  // Use setTimeout to further defer the plugin's heavy operations
  setTimeout(styleMoodleQuizForm, 2000);
});

// Function to call Coze AI API
async function askCozeAI(question) {
  try {
    const response = await fetch(COZE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COZE_API_KEY}`,
        'Content-Type': 'application/json',
        'Connection': 'keep-alive'
      },
      body: JSON.stringify({
        bot_id: COZE_BOT_ID,
        user: "chrome_extension_user",
        query: question,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.messages[0].content || 'No answer received';
  } catch (error) {
    console.error('Error calling Coze AI:', error);
    return 'Error getting AI response';
  }
}

// Function to auto-select radio/checkbox based on AI answer
function autoSelectAnswer(container, aiAnswer) {
  // Normalize AI answer
  const normalizedAnswer = aiAnswer.toLowerCase().trim();
  
  // Find radio/checkbox options
  const options = container.querySelectorAll('input[type="radio"], input[type="checkbox"]');
  const labels = container.querySelectorAll('label');
  
  // Map to store option texts
  const optionTexts = Array.from(labels).map(label => label.innerText.toLowerCase().trim());
  
  // Find matching index
  let matchIndex = -1;
  if (normalizedAnswer.includes('a') || normalizedAnswer.includes('对')) {
    matchIndex = optionTexts.findIndex(text => text.includes('a') || text.includes('对'));
  } else if (normalizedAnswer.includes('b') || normalizedAnswer.includes('错')) {
    matchIndex = optionTexts.findIndex(text => text.includes('b') || text.includes('错'));
  }
  
  // Select the matching option if found
  if (matchIndex !== -1 && options[matchIndex]) {
    options[matchIndex].click();
    return true;
  }
  
  return false;
}

// Function to style Moodle quiz form elements and add AI assistance
function styleMoodleQuizForm() {
  try {
    // Predefined AI instruction text
    const aiInstructionText = "Please only show me the answer a / b / AD. Only use ABCD these four letters, not show me other any informations.";

    // Select all questions
    const questions = document.querySelectorAll('.que');
    
    questions.forEach((question, index) => {
      // Performance: check if already processed
      if (question.querySelector('.ai-assist-container')) return;

      // Extract question text
      const questionTextEl = question.querySelector('.qtext p');
      const questionText = questionTextEl ? questionTextEl.innerText : `Question ${index + 1}`;
      
      // Extract choices
      const choiceLabels = question.querySelectorAll('.answer label');
      const choices = Array.from(choiceLabels).map(label => label.innerText).join(' | ');
      
      // Create container for AI assistance
      const aiAssistContainer = document.createElement('div');
      aiAssistContainer.classList.add('ai-assist-container');
      aiAssistContainer.style.marginTop = '10px';
      aiAssistContainer.style.border = '1px solid green';
      aiAssistContainer.style.padding = '10px';
      aiAssistContainer.style.borderRadius = '10px';
      
      // Create input textarea
      const inputTextarea = document.createElement('textarea');
      inputTextarea.value = `Question: ${questionText}\n\nChoices: ${choices}\n\n${aiInstructionText}`;
      inputTextarea.style.width = '100%';
      inputTextarea.style.minHeight = '100px';
      inputTextarea.style.marginBottom = '10px';
      inputTextarea.style.color = 'green';
      inputTextarea.style.borderColor = 'green';
      
      // Create output textarea for AI response
      const outputTextarea = document.createElement('textarea');
      outputTextarea.style.width = '100%';
      outputTextarea.style.minHeight = '50px';
      outputTextarea.style.marginBottom = '10px';
      outputTextarea.style.color = 'blue';
      outputTextarea.style.borderColor = 'blue';
      outputTextarea.placeholder = 'AI Answer will appear here';
      outputTextarea.readOnly = true;
      
      // Create AI ask button
      const askButton = document.createElement('button');
      askButton.innerText = 'Ask AI';
      askButton.style.backgroundColor = 'green';
      askButton.style.color = 'white';
      askButton.style.border = 'none';
      askButton.style.padding = '10px 20px';
      askButton.style.borderRadius = '5px';
      askButton.style.cursor = 'pointer';
      
      // Add event listener to ask button
      askButton.addEventListener('click', async () => {
        try {
          // Disable button during request
          askButton.disabled = true;
          askButton.style.opacity = '0.5';
          
          // Get AI response
          const aiResponse = await askCozeAI(inputTextarea.value);
          
          // Display AI response
          outputTextarea.value = aiResponse;
          
          // Try to auto-select answer
          const answerContainer = question.querySelector('.answer');
          if (answerContainer) {
            const autoSelected = autoSelectAnswer(answerContainer, aiResponse);
            if (autoSelected) {
              outputTextarea.value += '\n\n✓ Answer auto-selected';
            }
          }
        } catch (error) {
          outputTextarea.value = `Error: ${error.message}`;
        } finally {
          // Re-enable button
          askButton.disabled = false;
          askButton.style.opacity = '1';
        }
      });
      
      // Append elements to container
      aiAssistContainer.appendChild(inputTextarea);
      aiAssistContainer.appendChild(askButton);
      aiAssistContainer.appendChild(outputTextarea);
      
      // Insert the container after the question content
      const contentDiv = question.querySelector('.content');
      if (contentDiv) {
        contentDiv.appendChild(aiAssistContainer);
      }
    });

    // Styling for question texts
    const questionTexts = document.querySelectorAll('.qtext p');
    questionTexts.forEach((questionText) => {
      questionText.style.color = 'blue';
      
      const strongElements = questionText.querySelectorAll('strong');
      strongElements.forEach(strong => {
        strong.style.color = 'blue';
      });
      
      const spanElements = questionText.querySelectorAll('span');
      spanElements.forEach(span => {
        span.style.color = 'blue';
      });
    });

    // Styling for choice prompts
    const choicePrompts = document.querySelectorAll('.ablock .prompt');
    choicePrompts.forEach((prompt) => {
      prompt.style.color = 'green';
      prompt.style.fontWeight = 'bold';
    });

    // Styling for choice containers
    const choiceContainers = document.querySelectorAll('.r0, .r1');
    choiceContainers.forEach((container) => {
      const inputs = container.querySelectorAll('input[type="radio"], input[type="checkbox"]');
      inputs.forEach((input) => {
        input.style.color = 'green';
        input.style.accentColor = 'green';
      });

      const labels = container.querySelectorAll('label');
      labels.forEach((label) => {
        label.style.color = 'green';
        label.style.borderRadius = '20px';
        label.style.border = '2px solid green';
        label.style.padding = '10px';
        label.style.display = 'block';
        label.style.marginBottom = '10px';
      });
    });
  } catch (error) {
    console.error('Error in styleMoodleQuizForm:', error);
  }
}

// Fallback for pages that might not trigger load event
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(styleMoodleQuizForm, 2000);
});

// Also run when new content is dynamically loaded
const observer = new MutationObserver(styleMoodleQuizForm);
observer.observe(document.body, { 
  childList: true, 
  subtree: true 
});
