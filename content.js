// Coze AI Configuration
const COZE_API_KEY = 'pat_2R3oaaWVgYYzwl6fE17d4TUXI7Vrj2axBHAq9itiSvaQCSfDRdP1TB6EUxK17xBC';
const COZE_BOT_ID = '7446605387228397603';
const COZE_API_URL = 'https://api.coze.cn/open_api/v2/chat';

// Ensure full page load and resources are ready
function waitForFullPageLoad() {
  return new Promise((resolve) => {
    // If page is already loaded, resolve immediately
    if (document.readyState === 'complete') {
      resolve();
      return;
    }

    // Wait for all resources to load
    window.addEventListener('load', () => {
      // Additional wait to ensure dynamic content is loaded
      setTimeout(() => {
        // Check for specific page elements that indicate full load
        const pageLoadIndicators = [
          '.que', // Moodle quiz questions
          'form', // Generic form selector
          'input', // Input elements
          '.answer' // Answer containers
        ];

        function checkPageReadiness() {
          const indicatorFound = pageLoadIndicators.some(selector => 
            document.querySelector(selector) !== null
          );

          if (indicatorFound) {
            resolve();
          } else {
            // If indicators not found, wait a bit more
            setTimeout(checkPageReadiness, 500);
          }
        }

        checkPageReadiness();
      }, 2000); // Additional 2-second delay
    });
  });
}

// Main initialization function
async function initializePlugin() {
  try {
    // Wait for full page load
    await waitForFullPageLoad();

    // Run the styling and AI assistance
    styleMoodleQuizForm();

    // Optional: Add mutation observer for dynamically loaded content
    const observer = new MutationObserver((mutations) => {
      const quizContentChanged = mutations.some(mutation => 
        Array.from(mutation.addedNodes).some(node => 
          node.nodeType === Node.ELEMENT_NODE && 
          (node.matches('.que') || node.querySelector('.que'))
        )
      );

      if (quizContentChanged) {
        styleMoodleQuizForm();
      }
    });

    // Observe the entire document for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

  } catch (error) {
    console.error('Plugin initialization error:', error);
  }
}

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
function autoSelectAnswer(container, aiResponse) {
  // Normalize AI response
  const normalizedResponse = aiResponse.toLowerCase().trim();
  
  // Find radio/checkbox options
  const options = container.querySelectorAll('input[type="radio"], input[type="checkbox"]');
  const labels = container.querySelectorAll('label');
  
  // Map to store option texts with their corresponding inputs
  const optionMap = Array.from(labels).map((label, index) => ({
    text: label.innerText.toLowerCase().trim(),
    input: options[index],
    letter: String.fromCharCode(97 + index) // a, b, c, d...
  }));
  
  // Determine input type (radio or checkbox)
  const isCheckbox = options[0].type === 'checkbox';
  
  // Precise matching logic for multiple selections
  const selectedOptions = [];
  
  // Check for full letter responses (e.g., 'ab', 'abcd', 'bd')
  const letterMatches = normalizedResponse.match(/[abcd]+/);
  
  if (letterMatches) {
    const matchedLetters = letterMatches[0].split('');
    
    matchedLetters.forEach(letter => {
      const matchedOption = optionMap.find(opt => opt.letter === letter);
      if (matchedOption) {
        selectedOptions.push(matchedOption);
      }
    });
  }
  
  // Fallback for text-based responses
  if (selectedOptions.length === 0) {
    optionMap.forEach(opt => {
      if (normalizedResponse.includes(opt.text) || 
          normalizedResponse.includes(opt.letter)) {
        selectedOptions.push(opt);
      }
    });
  }
  
  // True/False specific handling
  if (selectedOptions.length === 0) {
    if (normalizedResponse.includes('true') || normalizedResponse.includes('对')) {
      const trueOption = optionMap.find(opt => 
        opt.text.includes('对') || opt.text.includes('true')
      );
      if (trueOption) selectedOptions.push(trueOption);
    } else if (normalizedResponse.includes('false') || normalizedResponse.includes('错')) {
      const falseOption = optionMap.find(opt => 
        opt.text.includes('错') || opt.text.includes('false')
      );
      if (falseOption) selectedOptions.push(falseOption);
    }
  }
  
  // Select the matching options
  let selectionMade = false;
  selectedOptions.forEach(opt => {
    // Ensure the input is visible and not disabled
    if (!opt.input.disabled && opt.input.offsetParent !== null) {
      // For radio, only select the first matching option
      if (!isCheckbox) {
        opt.input.click();
        selectionMade = true;
        return;
      }
      
      // For checkbox, click all matching options
      opt.input.click();
      selectionMade = true;
    }
  });
  
  return selectionMade;
}

// Function to create a delay with random duration between 3-6 seconds
function randomDelay() {
  return new Promise(resolve => {
    const delay = Math.floor(Math.random() * (6000 - 3000 + 1)) + 3000;
    setTimeout(resolve, delay);
  });
}

// Function to sequentially process all AI ask buttons
async function autoCompleteAllQuestions() {
  // Find all AI ask buttons
  const askButtons = document.querySelectorAll('.ai-assist-container .ask-ai-button');
  
  // Disable the global auto-complete button during processing
  const globalAutoCompleteButton = document.getElementById('global-auto-complete-btn');
  if (globalAutoCompleteButton) {
    globalAutoCompleteButton.disabled = true;
    globalAutoCompleteButton.style.opacity = '0.5';
  }
  
  // Create a countdown display
  const countdownDisplay = document.createElement('div');
  countdownDisplay.id = 'auto-complete-countdown';
  countdownDisplay.style.position = 'fixed';
  countdownDisplay.style.top = '20px';
  countdownDisplay.style.right = '20px';
  countdownDisplay.style.backgroundColor = 'orange';
  countdownDisplay.style.color = 'white';
  countdownDisplay.style.padding = '10px';
  countdownDisplay.style.borderRadius = '10px';
  countdownDisplay.style.zIndex = '9999';
  document.body.appendChild(countdownDisplay);
  
  try {
    for (let i = 0; i < askButtons.length; i++) {
      // Update countdown display
      countdownDisplay.innerText = `Processing Question ${i + 1}/${askButtons.length}`;
      
      // Trigger AI ask button click
      askButtons[i].click();
      
      // Wait for random delay
      for (let countdown = 5; countdown > 0; countdown--) {
        countdownDisplay.innerText = `Next in ${countdown} seconds (Question ${i + 1}/${askButtons.length})`;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Additional random delay between 3-6 seconds
      await randomDelay();
    }
    
    // Final message
    countdownDisplay.innerText = 'All questions processed!';
    countdownDisplay.style.backgroundColor = 'green';
  } catch (error) {
    console.error('Auto-complete error:', error);
    countdownDisplay.innerText = 'Error during auto-complete';
    countdownDisplay.style.backgroundColor = 'red';
  } finally {
    // Re-enable the global auto-complete button
    if (globalAutoCompleteButton) {
      setTimeout(() => {
        globalAutoCompleteButton.disabled = false;
        globalAutoCompleteButton.style.opacity = '1';
        document.body.removeChild(countdownDisplay);
      }, 3000);
    }
  }
}

// Function to style Moodle quiz form elements and add AI assistance
function styleMoodleQuizForm() {
  try {
    // Predefined AI instruction text
    const aiInstructionText = "Please answer only using A, B, C, or D. If the answer is correct, show A. If the answer is incorrect, show B. Do not include any additional information.";

    // Create global auto-complete button
    const globalAutoCompleteButton = document.createElement('button');
    globalAutoCompleteButton.id = 'global-auto-complete-btn';
    globalAutoCompleteButton.innerText = 'Auto Complete All Questions';
    globalAutoCompleteButton.style.position = 'fixed';
    globalAutoCompleteButton.style.top = '20px';
    globalAutoCompleteButton.style.left = '20px';
    globalAutoCompleteButton.style.backgroundColor = 'purple';
    globalAutoCompleteButton.style.color = 'white';
    globalAutoCompleteButton.style.padding = '10px 20px';
    globalAutoCompleteButton.style.borderRadius = '10px';
    globalAutoCompleteButton.style.zIndex = '9999';
    globalAutoCompleteButton.style.border = 'none';
    globalAutoCompleteButton.style.cursor = 'pointer';
    
    // Add event listener to global auto-complete button
    globalAutoCompleteButton.addEventListener('click', autoCompleteAllQuestions);
    
    // Add button to body
    document.body.appendChild(globalAutoCompleteButton);

    // Select all questions
    const questions = document.querySelectorAll('.que');
    
    questions.forEach((question, index) => {
      // Skip section titles or non-question elements
      const questionTextEl = question.querySelector('.qtext');
      
      // Check for section titles or non-question elements
      if (!questionTextEl) return;
      
      // Additional check for section titles
      const titleKeywords = [
        '判断题', 
        '选择题', 
        '单项选择题', 
        '一、', 
        '、单项选择题', 
        '第一部分', 
        '第二部分',
        '每题',
        '共'
      ];
      const questionText = questionTextEl.innerText.trim();
      
      // Skip if the text matches section title keywords
      if (titleKeywords.some(keyword => questionText.includes(keyword))) return;
      
      // Performance: check if already processed
      if (question.querySelector('.ai-assist-container')) return;

      // Extract full question text
      let fullQuestionText = '';
      
      if (questionTextEl) {
        // Handle multi-line questions
        const paragraphs = questionTextEl.querySelectorAll('p');
        if (paragraphs.length > 0) {
          // Collect all paragraph texts
          const paragraphTexts = Array.from(paragraphs).map(p => p.innerText);
          
          // Add bracket only to the last line
          paragraphTexts[paragraphTexts.length - 1] += ']';
          
          // Join paragraphs for full question text
          fullQuestionText = paragraphTexts.join('\n');
        } else {
          // Fallback if no paragraphs
          fullQuestionText = `[${questionTextEl.innerText}]`;
        }
      } else {
        fullQuestionText = `[Question ${index + 1}]`;
      }
      
      // Extract full option text with letter and content
      const optionContainers = question.querySelectorAll('.r0, .r1');
      const options = Array.from(optionContainers).map(container => {
        const letterSpan = container.querySelector('.answernumber');
        const contentSpan = container.querySelector('p span');
        const contentDiv = container.querySelector('.d-flex');
        const label = container.querySelector('label');
        
        // Combine all possible content sources
        let fullContent = '';
        if (letterSpan) fullContent += letterSpan.textContent.trim() + ' ';
        if (contentSpan) fullContent += contentSpan.textContent.trim();
        if (contentDiv && !fullContent) fullContent = contentDiv.textContent.trim();
        if (label) fullContent += label.textContent.trim();
        
        return fullContent;
      }).filter(option => option !== '');
      
      // Capture the full HTML structure of the answer container
      const answerContainerHTML = question.querySelector('.answer') ? 
        question.querySelector('.answer').outerHTML : 
        'No answer container found';
      
      // Check if it's a true/false question (only two options)
      let isTrueFalseQuestion = options.length === 2 && 
        (options[0].toLowerCase().includes('对') || options[0].toLowerCase().includes('true') ||
         options[0].toLowerCase().includes('错') || options[0].toLowerCase().includes('false'));
      
      // Modify question text for true/false questions
      if (isTrueFalseQuestion) {
        fullQuestionText = `[For true/false questions: ${fullQuestionText.replace(/^\[|\]$/g, '')}]`;
      }
      
      // Create container for AI assistance
      const aiAssistContainer = document.createElement('div');
      aiAssistContainer.classList.add('ai-assist-container');
      aiAssistContainer.style.marginTop = '10px';
      aiAssistContainer.style.border = '1px solid orange';
      aiAssistContainer.style.padding = '10px';
      aiAssistContainer.style.borderRadius = '10px';
      
      // Create input textarea
      const inputTextarea = document.createElement('textarea');
      inputTextarea.value = `${fullQuestionText}\n\nOptions:\n${options.join('\n')}\n\nAnswer Container HTML:\n${answerContainerHTML}\n\n${aiInstructionText}`;
      inputTextarea.style.width = '100%';
      inputTextarea.style.minHeight = '150px';
      inputTextarea.style.marginBottom = '10px';
      inputTextarea.style.color = 'orange !important';
      inputTextarea.style.borderColor = 'orange !important';
      
      // Create output textarea for AI response
      const outputTextarea = document.createElement('textarea');
      outputTextarea.style.width = '100%';
      outputTextarea.style.minHeight = '50px';
      outputTextarea.style.marginBottom = '10px';
      outputTextarea.style.color = 'orange !important';
      outputTextarea.style.borderColor = 'orange !important';
      outputTextarea.placeholder = 'AI Answer will appear here';
      outputTextarea.readOnly = true;
      
      // Create AI ask button
      const askButton = document.createElement('button');
      askButton.classList.add('ask-ai-button');
      askButton.innerText = 'Ask AI';
      askButton.style.backgroundColor = 'orange';
      askButton.style.color = 'white';
      askButton.style.border = 'none';
      askButton.style.padding = '10px 20px';
      askButton.style.borderRadius = '5px';
      askButton.style.cursor = 'pointer';
      askButton.style.marginRight = '10px';
      
      // Create auto-select button
      const autoSelectButton = document.createElement('button');
      autoSelectButton.innerText = 'Auto Select';
      autoSelectButton.style.backgroundColor = 'purple';
      autoSelectButton.style.color = 'white';
      autoSelectButton.style.border = 'none';
      autoSelectButton.style.padding = '10px 20px';
      autoSelectButton.style.borderRadius = '5px';
      autoSelectButton.style.cursor = 'pointer';
      
      // Button container
      const buttonContainer = document.createElement('div');
      buttonContainer.style.display = 'flex';
      buttonContainer.style.gap = '10px';
      buttonContainer.style.marginBottom = '10px';
      
      // Add buttons to container
      buttonContainer.appendChild(askButton);
      buttonContainer.appendChild(autoSelectButton);
      
      // Auto-select button event listener
      autoSelectButton.addEventListener('click', () => {
        // Get the current output textarea content
        const textareaContent = outputTextarea.value;
        
        // Try to auto-select answer
        const answerContainer = question.querySelector('.answer');
        if (answerContainer) {
          const autoSelected = autoSelectAnswer(answerContainer, textareaContent);
          if (autoSelected) {
            outputTextarea.value += '\n\n✓ Answer auto-selected from AI response';
          } else {
            outputTextarea.value += '\n\n✗ Could not auto-select answer';
          }
        }
      });
      
      // Add event listener to ask button
      askButton.addEventListener('click', async () => {
        try {
          // Disable buttons during request
          askButton.disabled = true;
          autoSelectButton.disabled = true;
          askButton.style.opacity = '0.5';
          autoSelectButton.style.opacity = '0.5';
          
          // Get AI response
          const aiResponse = await askCozeAI(inputTextarea.value);
          
          // Display AI response
          outputTextarea.value = aiResponse;
          
          // Try to auto-select answer
          const answerContainer = question.querySelector('.answer');
          console.log('Answer Container:', answerContainer);
          console.log('AI Response:', aiResponse);
          
          if (answerContainer) {
            const autoSelected = autoSelectAnswer(answerContainer, aiResponse);
            console.log('Auto-selected:', autoSelected);
            
            if (autoSelected) {
              outputTextarea.value += '\n\n✓ Answer auto-selected';
            } else {
              outputTextarea.value += '\n\n✗ No matching option found';
            }
          } else {
            console.error('No answer container found for this question');
          }
        } catch (error) {
          outputTextarea.value = `Error: ${error.message}`;
          console.error('Auto-select error:', error);
        } finally {
          // Re-enable buttons
          askButton.disabled = false;
          autoSelectButton.disabled = false;
          askButton.style.opacity = '1';
          autoSelectButton.style.opacity = '1';
        }
      });
      
      // Append elements to container
      aiAssistContainer.appendChild(buttonContainer);
      aiAssistContainer.appendChild(inputTextarea);
      aiAssistContainer.appendChild(outputTextarea);
      
      // Insert the container after the question content
      const contentDiv = question.querySelector('.content');
      if (contentDiv) {
        contentDiv.appendChild(aiAssistContainer);
      }
    });

    // Styling for question texts
    const questionTexts = document.querySelectorAll('.qtext');
    questionTexts.forEach((questionText) => {
      const paragraphs = questionText.querySelectorAll('p');
      
      if (paragraphs.length > 0) {
        // For multi-line questions, only add bracket to last paragraph
        paragraphs.forEach((p, index) => {
          p.style.color = 'pink !important';
          
          if (index === paragraphs.length - 1) {
            // Ensure the last paragraph has the closing bracket
            if (!p.innerHTML.includes(']')) {
              p.innerHTML += ']';
            }
          }
        });
      } else {
        // For single-line questions
        if (!questionText.innerHTML.includes(']')) {
          questionText.innerHTML = `[${questionText.innerText}]`;
        }
        questionText.style.color = 'pink !important';
      }
    });

    // Styling for option prompts
    const optionPrompts = document.querySelectorAll('.ablock .prompt');
    optionPrompts.forEach((prompt) => {
      prompt.style.color = 'orange !important';
      prompt.style.fontWeight = 'bold';
    });

    // Styling for option containers
    const optionContainers = document.querySelectorAll('.r0, .r1');
    optionContainers.forEach((container) => {
      const inputs = container.querySelectorAll('input[type="radio"], input[type="checkbox"]');
      inputs.forEach((input) => {
        input.style.color = 'orange !important';
        input.style.accentColor = 'orange !important';
      });

      const labels = container.querySelectorAll('label');
      labels.forEach((label) => {
        label.style.color = 'orange !important';
        label.style.borderRadius = '20px';
        label.style.border = '2px solid orange !important';
        label.style.padding = '10px';
        label.style.display = 'block';
        label.style.marginBottom = '10px';
      });

      // Style the text spans within labels
      const textSpans = container.querySelectorAll('label span, label p');
      textSpans.forEach((span) => {
        span.style.color = 'orange !important';
      });
    });
  } catch (error) {
    console.error('Error in styleMoodleQuizForm:', error);
  }
}

// Start the plugin initialization
initializePlugin();
