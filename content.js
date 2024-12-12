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

    // Style Moodle quiz form
    styleMoodleQuizForm();

    // Set up message listener
    setupMessageListener();

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

// Utility function to safely extract text from various input types
function safeExtractText(input) {
  // If input is already a string, return it
  if (typeof input === 'string') {
    return input.trim();
  }
  
  // If input is an HTML element, try to get its text content
  if (input instanceof HTMLElement) {
    return input.textContent || input.innerText || '';
  }
  
  // If input is an object with a 'response' property, try to extract text
  if (typeof input === 'object' && input !== null) {
    if (input.response && typeof input.response === 'string') {
      return input.response.trim();
    }
    
    // Try to convert to string and trim
    return String(input).trim();
  }
  
  // Last resort: convert to string
  return String(input).trim();
}

// Robust Message Listener Setup
function setupMessageListener() {
  console.log('设置消息监听器');
  
  try {
    // Ensure chrome.runtime is available
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      if (chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
          console.log('Message received:', request);
          
          // Handle different message types
          if (request.action === 'autoComplete') {
            autoCompleteAllQuestions();
          }
          
          // Always send a response to avoid errors
          sendResponse({ status: 'received' });
          
          return true;
        });
        
        console.log('Message listener set up successfully');
      } else {
        console.error('chrome.runtime.onMessage is not available');
      }
    } else {
      console.error('Chrome runtime is not available');
    }
  } catch (error) {
    console.error('Error setting up message listener:', error);
  }
}

// Enhanced Matching Strategies
function findMatchingOptions(aiResponse, optionMap) {
  // Safely extract text from the response
  const processedResponse = safeExtractText(aiResponse);
  
  // Skip processing if no meaningful text
  if (!processedResponse) {
    console.log('No processable text in AI response');
    return [];
  }

  const chineseLetters = ['A', 'B', 'C', 'D'];
  const chineseOptions = ['甲', '乙', '丙', '丁'];
  const aiResponseLower = processedResponse.toLowerCase().trim();

  // Comprehensive Matching Strategies
  const matchingStrategies = [
    // Strategy 1: Exact Single Letter Matching
    () => {
      // Match exact single letters (A, B, C, D)
      const exactLetterMatch = chineseLetters.find(letter => 
        aiResponseLower === letter.toLowerCase()
      );
      
      if (exactLetterMatch) {
        const index = chineseLetters.indexOf(exactLetterMatch);
        return [optionMap[index]].filter(Boolean);
      }
      
      return [];
    },
    
    // Strategy 2: Multiple Letter Matching
    () => {
      const multiLetterMatches = aiResponseLower.match(/[abcd]+/g);
      if (multiLetterMatches) {
        const matchedLetters = multiLetterMatches[0].split('').map(l => l.toUpperCase());
        return matchedLetters.map(letter => 
          optionMap.find(opt => opt.letter === letter.toLowerCase())
        ).filter(Boolean);
      }
      
      return [];
    },
    
    // Strategy 3: Chinese Character Matching
    () => {
      const chineseMatch = chineseOptions.find(char => 
        aiResponseLower.includes(char.toLowerCase())
      );
      
      if (chineseMatch) {
        const index = chineseOptions.indexOf(chineseMatch);
        return [optionMap[index]].filter(Boolean);
      }
      
      return [];
    },
    
    // Strategy 4: Partial and Flexible Matching
    () => {
      return optionMap.filter(opt => {
        const optLetterLower = opt.letter.toLowerCase();
        const optTextLower = opt.text.toLowerCase();
        
        return (
          aiResponseLower.includes(optLetterLower) ||
          optTextLower.includes(aiResponseLower) ||
          chineseLetters.some(letter => 
            aiResponseLower.includes(letter.toLowerCase())
          )
        );
      });
    },
    
    // Strategy 5: Keyword and Ordinal Matching
    () => {
      const keywords = {
        'A': ['first', '第一', '首选'],
        'B': ['second', '第二'],
        'C': ['third', '第三'],
        'D': ['fourth', '第四']
      };
      
      return optionMap.filter(opt => {
        const optLetter = opt.letter.toUpperCase();
        return keywords[optLetter] && keywords[optLetter].some(keyword => 
          aiResponseLower.includes(keyword)
        );
      });
    }
  ];

  // Combine results from all strategies, removing duplicates
  const selectedOptions = matchingStrategies.reduce((acc, strategy) => {
    const matchedOptions = strategy();
    if (matchedOptions.length > 0) {
      return [...acc, ...matchedOptions];
    }
    return acc;
  }, []);

  const uniqueSelectedOptions = [...new Set(selectedOptions)];
  
  console.log('Matching Debug:', {
    originalResponse: aiResponse,
    processedResponse: processedResponse,
    matchedOptionsCount: uniqueSelectedOptions.length,
    matchedOptions: uniqueSelectedOptions.map(opt => ({
      text: opt.text,
      letter: opt.letter
    }))
  });

  return uniqueSelectedOptions;
}

// Modify existing code to use the new matching function
function autoSelectAnswer(aiResponse) {
  console.log('Auto Select Button Clicked');
  console.log('AI Response:', aiResponse);
  
  const answerContainer = document.querySelector('.answer');
  console.log('Answer Container:', answerContainer);
  
  if (!answerContainer) {
    console.error('No answer container found');
    return false;
  }
  
  const optionElements = answerContainer.querySelectorAll('input[type="radio"], input[type="checkbox"]');
  const labelElements = answerContainer.querySelectorAll('label');
  
  console.log('Options found:', optionElements.length);
  console.log('Labels found:', labelElements.length);
  
  if (optionElements.length === 0) {
    console.error('No input options found');
    return false;
  }
  
  // Create option map with letter, text, and input element
  const optionMap = Array.from(optionElements).map((input, index) => {
    const label = labelElements[index];
    return {
      input: input,
      letter: String.fromCharCode(65 + index), // A, B, C, D
      text: label ? label.textContent.trim() : ''
    };
  });
  
  // Find matching options using enhanced strategy
  const matchedOptions = findMatchingOptions(aiResponse, optionMap);
  
  if (matchedOptions.length > 0) {
    matchedOptions.forEach(option => {
      console.log('Selecting option:', option.text);
      option.input.click();
    });
    
    console.log('Selection Made: true');
    return true;
  }
  
  console.log('Selection Made: false');
  return false;
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
      outputTextarea.placeholder = 'AI Response';
      outputTextarea.rows = 4;
      outputTextarea.style.width = '100%';
      outputTextarea.style.marginBottom = '10px';
      outputTextarea.style.padding = '5px';
      outputTextarea.style.borderRadius = '4px';
      outputTextarea.style.border = '1px solid #ccc';
      outputTextarea.setAttribute('data-ai-response', 'true');
      
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
      autoSelectButton.addEventListener('click', (event) => {
        // Prevent page refresh
        event.preventDefault();
        event.stopPropagation();
        
        console.log('Auto Select Button Clicked');
        
        // Get the answer from the second textarea (AI response)
        const aiResponseTextarea = question.querySelector('textarea[data-ai-response="true"]');
        const aiResponse = aiResponseTextarea ? aiResponseTextarea.value.trim() : '';
        
        console.log('AI Response:', aiResponse);
        
        // Try to auto-select answer
        const answerContainer = question.querySelector('.answer');
        console.log('Answer Container:', answerContainer);
        
        if (answerContainer && aiResponse) {
          // Find all input options
          const options = answerContainer.querySelectorAll('input[type="radio"], input[type="checkbox"]');
          const labels = answerContainer.querySelectorAll('label');
          
          console.log('Options found:', options.length);
          console.log('Labels found:', labels.length);
          
          // Create option map
          const optionMap = Array.from(labels).map((label, index) => {
            const labelText = label.innerText.toLowerCase().trim();
            return {
              text: labelText,
              input: options[index],
              letter: String.fromCharCode(97 + index)
            };
          });
          
          // Matching strategies
          const matchingStrategies = [
            // 1. Exact letter match with multiple strategies
            () => {
              const chineseLetters = ['A', 'B', 'C', 'D'];
              const chineseOptions = ['甲', '乙', '丙', '丁'];
              const aiResponseLower = aiResponse.toLowerCase().trim();
              
              // Strategy 1: Exact single letter matching (most precise)
              const exactSingleLetterMatch = chineseLetters.find(letter => 
                aiResponseLower === letter.toLowerCase()
              );
              
              if (exactSingleLetterMatch) {
                const index = chineseLetters.indexOf(exactSingleLetterMatch);
                return [optionMap[index]].filter(Boolean);
              }
              
              // Strategy 2: Multiple letter matching
              const multiLetterMatches = aiResponseLower.match(/[abcd]+/g);
              if (multiLetterMatches) {
                const matchedLetters = multiLetterMatches[0].split('').map(l => l.toUpperCase());
                return matchedLetters.map(letter => 
                  optionMap.find(opt => opt.letter === letter.toLowerCase())
                ).filter(Boolean);
              }
              
              // Strategy 3: Chinese character match
              const chineseMatch = chineseOptions.find(char => 
                aiResponseLower.includes(char.toLowerCase())
              );
              
              if (chineseMatch) {
                const index = chineseOptions.indexOf(chineseMatch);
                return [optionMap[index]].filter(Boolean);
              }
              
              // Strategy 4: Partial match with letters or Chinese characters
              const partialMatches = optionMap.filter(opt => {
                const optLetterLower = opt.letter.toLowerCase();
                const optTextLower = opt.text.toLowerCase();
                
                return (
                  aiResponseLower.includes(optLetterLower) ||
                  chineseLetters.some(letter => aiResponseLower.includes(letter.toLowerCase())) ||
                  chineseOptions.some(char => aiResponseLower.includes(char.toLowerCase())) ||
                  optTextLower.includes(aiResponseLower)
                );
              });
              
              return partialMatches;
            },
            
            // 2. Text-based matching with multiple approaches
            () => {
              const aiResponseLower = aiResponse.toLowerCase().trim();
              
              return optionMap.filter(opt => {
                const optTextLower = opt.text.toLowerCase();
                
                // Check for exact text match
                if (aiResponseLower === optTextLower) return true;
                
                // Check for partial text match
                if (optTextLower.includes(aiResponseLower) || 
                    aiResponseLower.includes(optTextLower)) return true;
                
                return false;
              });
            },
            
            // 3. Keyword-based matching
            () => {
              const keywords = {
                'A': ['first', '第一', '首选'],
                'B': ['second', '第二'],
                'C': ['third', '第三'],
                'D': ['fourth', '第四']
              };
              
              const aiResponseLower = aiResponse.toLowerCase().trim();
              
              return optionMap.filter(opt => {
                const optLetter = opt.letter.toUpperCase();
                return keywords[optLetter].some(keyword => 
                  aiResponseLower.includes(keyword)
                );
              });
            },
            
            // 4. True/False specific handling
            () => {
              const normalizedContent = aiResponse.toLowerCase().trim();
              
              if (normalizedContent.includes('true') || normalizedContent.includes('对')) {
                return optionMap.filter(opt => 
                  opt.text.toLowerCase().includes('true') || 
                  opt.text.toLowerCase().includes('对')
                );
              }
              
              if (normalizedContent.includes('false') || normalizedContent.includes('错')) {
                return optionMap.filter(opt => 
                  opt.text.toLowerCase().includes('false') || 
                  opt.text.toLowerCase().includes('错')
                );
              }
              
              return [];
            }
          ];
          
          // Collect all matching options with enhanced matching
          const selectedOptions = matchingStrategies.reduce((acc, strategy) => {
            const matchedOptions = strategy();
            if (matchedOptions.length > 0) {
              return [...acc, ...matchedOptions];
            }
            return acc;
          }, []);
          
          // Remove duplicates and log detailed matching information
          const uniqueSelectedOptions = [...new Set(selectedOptions)];
          
          console.log('Matching Debug:', {
            aiResponse: aiResponse,
            matchedOptionsCount: uniqueSelectedOptions.length,
            matchedOptions: uniqueSelectedOptions.map(opt => ({
              text: opt.text,
              letter: opt.letter
            }))
          });
          
          // Select the matching options
          let selectionMade = false;
          uniqueSelectedOptions.forEach(opt => {
            // Ensure the input is visible and not disabled
            if (!opt.input.disabled && opt.input.offsetParent !== null) {
              console.log('Selecting option:', opt.text);
              
              // For radio, only select the first matching option
              if (!isTrueFalseQuestion) {
                opt.input.click();
                selectionMade = true;
                return;
              }
              
              // For checkbox, click all matching options
              opt.input.click();
              selectionMade = true;
            }
          });
          
          console.log('Selection Made:', selectionMade);
          return selectionMade;
        } else {
          console.log('No AI response or answer container found');
          return false;
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
