// ==========================================
// CONTENT SCRIPT: Surgical Rendering & Cursor Management
// ==========================================

console.log("LaTeX Extension: Listening for Alt + M (or Option + M)");

// 1. Trusted Types Security Policy
let latexPolicy;
if (window.trustedTypes && window.trustedTypes.createPolicy) {
  latexPolicy = window.trustedTypes.createPolicy('latex-email-policy', {
    createHTML: (string) => string
  });
}

// 2. Intercept Alt + M (Option + M)
document.addEventListener('keydown', (event) => {
  if (event.altKey && event.key.toLowerCase() === 'm') {
    const target = event.target;
    const isEditable = target.isContentEditable || 
                       target.closest('[contenteditable="true"]') || 
                       target.closest('[role="textbox"]');
    
    if (isEditable) {
      renderEquationsInSelection(event);
    }
  }
}, true); 

// 3. Surgical DOM Traversal & Rendering
function renderEquationsInSelection(event) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  let node = selection.focusNode;

  // We ONLY want to operate on raw Text Nodes to protect Gmail's formatting tags
  if (node.nodeType !== Node.TEXT_NODE) {
    console.log("Cursor is not on raw text. Try placing it directly inside the equation.");
    return;
  }

  const text = node.nodeValue;
  const regex = /\$\$([\s\S]*?)\$\$/;
  const match = regex.exec(text);

  if (match) {
    // Stop any browser default behaviors for the hotkey
    event.preventDefault(); 
    event.stopPropagation(); 

    const startIndex = match.index;
    const endIndex = startIndex + match[0].length;
    const latexCode = match[1];

    // Compile the KaTeX HTML
    let updatedText = "";
    try {
      updatedText = katex.renderToString(latexCode.trim(), { 
        displayMode: false, 
        throwOnError: false 
      });
    } catch (e) {
      console.error("KaTeX error:", e);
      return; 
    }

    // Create the wrapper for the visual equation
    const wrapper = document.createElement('span');
    if (latexPolicy) {
      wrapper.innerHTML = latexPolicy.createHTML(updatedText);
    } else {
      wrapper.innerHTML = updatedText;
    }

    // Create a Zero-Width Space so the cursor has a normal text node to safely land in
    const safeSpace = document.createTextNode('\u200B');

    // SURGICAL DOM SPLIT:
    // 1. Split the text node exactly where the equation ends
    const textAfter = node.splitText(endIndex);
    
    // 2. Erase the raw $$ equation from the first half of the text node
    node.nodeValue = node.nodeValue.substring(0, startIndex);

    // 3. Insert the rendered equation and the safe space between the two text halves
    const parent = node.parentNode;
    parent.insertBefore(wrapper, textAfter);
    parent.insertBefore(safeSpace, textAfter);

    // 4. Force the cursor to sit right after the equation inside our safe space
    const newRange = document.createRange();
    newRange.setStart(safeSpace, 1);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
    
    console.log("Equation rendered surgically! Font and cursor protected.");
  }
}