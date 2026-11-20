/* North Star Bakery - interactive pre-order shortlist and form validation */

'use strict';

/* ------------------------------------------------------------------ */
/* Shared browser storage helpers                                      */
/* The shortlist is stored as an object: { productId: { ...item } }.   */
/* ------------------------------------------------------------------ */
const STORAGE_KEY = 'northStarBakery.shortlist';

function loadShortlist() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return {};
    }

    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    // Only keep well-formed entries so old or broken data cannot break the page.
    const clean = {};
    Object.keys(parsed).forEach(function (id) {
      const item = parsed[id];
      if (
        item &&
        typeof item.name === 'string' &&
        typeof item.price === 'string' &&
        Number.isInteger(item.quantity) &&
        item.quantity >= 1 &&
        item.quantity <= 99
      ) {
        clean[id] = {
          id: id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        };
      }
    });
    return clean;
  } catch (error) {
    return {};
  }
}

function saveShortlist(shortlist) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shortlist));
  } catch (error) {
    // The page still works if the browser has storage disabled.
  }
}

function formatShortlistLines(shortlist) {
  return Object.keys(shortlist).map(function (id) {
    const item = shortlist[id];
    return item.quantity + ' × ' + item.name + ' (' + item.price + ')';
  });
}

/* ------------------------------------------------------------------ */
/* Feature 1: pre-order shortlist (products.html)                      */
/* ------------------------------------------------------------------ */
(function initShortlistFeature() {
  const panel = document.getElementById('shortlist-panel');
  if (!panel) {
    return; // This feature only belongs on the products page.
  }

  const countElement = document.getElementById('shortlist-count');
  const itemsElement = document.getElementById('shortlist-items');
  const emptyMessage = document.getElementById('shortlist-empty');
  const clearButton = document.getElementById('clear-shortlist');
  const orderLink = document.getElementById('shortlist-order-link');

  // PRODUCTS is an array of objects built from the product cards in the page.
  const products = Array.from(document.querySelectorAll('.product-card')).map(function (card) {
    return {
      id: card.dataset.productId,
      name: card.dataset.productName,
      price: card.dataset.productPrice,
      category: card.dataset.productCategory,
      controls: card.querySelector('.product-controls'),
      button: null,
      quantityBox: null,
      quantityInput: null
    };
  });

  const productById = {};
  products.forEach(function (product) {
    productById[product.id] = product;
  });

  let shortlist = loadShortlist();

  function createButton(text, className, action, id, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    button.dataset.action = action;
    button.dataset.id = id;
    button.setAttribute('aria-label', label);
    return button;
  }

  function buildProductControls(product) {
    product.button = createButton(
      '',
      'shortlist-button',
      'toggle',
      product.id,
      'Add ' + product.name + ' to shortlist'
    );
    product.controls.appendChild(product.button);

    const quantityBox = document.createElement('div');
    quantityBox.className = 'quantity-box';

    const label = document.createElement('label');
    label.textContent = 'Qty';
    const inputId = 'qty-' + product.id;
    label.setAttribute('for', inputId);

    const decrease = createButton('−', 'quantity-button', 'decrease', product.id, 'Decrease quantity of ' + product.name);
    const increase = createButton('+', 'quantity-button', 'increase', product.id, 'Increase quantity of ' + product.name);
    const remove = createButton('Remove', 'text-button remove-button', 'remove', product.id, 'Remove ' + product.name + ' from shortlist');

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.max = '99';
    input.step = '1';
    input.id = inputId;
    input.className = 'quantity-input';
    input.dataset.id = product.id;

    quantityBox.append(label, decrease, input, increase, remove);
    product.controls.appendChild(quantityBox);
    product.quantityBox = quantityBox;
    product.quantityInput = input;
  }

  function addItem(id) {
    const product = productById[id];
    shortlist[id] = {
      id: id,
      name: product.name,
      price: product.price,
      category: product.category,
      quantity: 1
    };
    saveShortlist(shortlist);
    render();
  }

  function removeItem(id) {
    delete shortlist[id];
    saveShortlist(shortlist);
    render();
  }

  function setQuantity(id, quantity) {
    if (!shortlist[id]) {
      return;
    }
    const capped = Math.min(99, Math.max(0, quantity));
    if (capped === 0) {
      removeItem(id);
      return;
    }
    shortlist[id].quantity = capped;
    saveShortlist(shortlist);
    render();
  }

  function handleProductClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button || !productById[button.dataset.id]) {
      return;
    }

    const id = button.dataset.id;
    const entry = shortlist[id];

    if (button.dataset.action === 'toggle') {
      if (entry) {
        removeItem(id);
      } else {
        addItem(id);
      }
    } else if (button.dataset.action === 'increase') {
      setQuantity(id, entry.quantity + 1);
    } else if (button.dataset.action === 'decrease') {
      setQuantity(id, entry.quantity - 1);
    } else if (button.dataset.action === 'remove') {
      removeItem(id);
    }
  }

  function handleQuantityChange(event) {
    if (!event.target.classList.contains('quantity-input')) {
      return;
    }
    const entered = parseInt(event.target.value, 10);
    setQuantity(event.target.dataset.id, Number.isNaN(entered) ? 1 : entered);
  }

  function updateProductCard(product) {
    const entry = shortlist[product.id];
    product.button.textContent = entry ? '✓ In your shortlist' : '+ Add to shortlist';
    product.button.classList.toggle('is-saved', Boolean(entry));
    product.button.setAttribute('aria-pressed', entry ? 'true' : 'false');
    product.quantityBox.hidden = !entry;
    if (entry) {
      product.quantityInput.value = entry.quantity;
    }
  }

  function renderShortlistPanel() {
    itemsElement.textContent = '';

    const ids = Object.keys(shortlist);
    const total = ids.reduce(function (sum, id) {
      return sum + shortlist[id].quantity;
    }, 0);

    countElement.textContent = ids.length === 0
      ? 'Nothing saved yet'
      : total + (total === 1 ? ' item' : ' items') + ' from ' +
        ids.length + (ids.length === 1 ? ' product' : ' products') + ' saved';

    emptyMessage.hidden = ids.length > 0;
    clearButton.disabled = ids.length === 0;
    orderLink.hidden = ids.length === 0;

    ids.forEach(function (id) {
      const item = shortlist[id];
      const listItem = document.createElement('li');
      listItem.className = 'shortlist-item';

      const description = document.createElement('span');
      description.textContent = item.quantity + ' × ' + item.name + ' — ' + item.price;

      const remove = createButton('Remove', 'text-button remove-button', 'remove', id, 'Remove ' + item.name + ' from shortlist');
      listItem.append(description, remove);
      itemsElement.appendChild(listItem);
    });
  }

  function render() {
    products.forEach(updateProductCard);
    renderShortlistPanel();
  }

  function clearShortlist() {
    shortlist = {};
    saveShortlist(shortlist);
    render();
  }

  products.forEach(buildProductControls);
  document.addEventListener('click', handleProductClick);
  document.addEventListener('change', handleQuantityChange);
  clearButton.addEventListener('click', clearShortlist);
  render();
})();

/* ------------------------------------------------------------------ */
/* Feature 2: contact form validation and shortlist pre-fill           */
/* ------------------------------------------------------------------ */
(function initContactForm() {
  const form = document.getElementById('preorder-form');
  if (!form) {
    return; // This feature only belongs on the contact page.
  }

  const details = document.getElementById('details');
  const shortlistNote = document.getElementById('shortlist-note');
  const addShortlistButton = document.getElementById('add-shortlist-details');
  const successMessage = document.getElementById('form-success');

  // An array of rule objects keeps each check and its message together.
  const validationRules = [
    {
      id: 'name',
      message: 'Enter your name using at least 2 letters (letters, spaces, apostrophes, periods, and hyphens only).',
      isValid: function (value) {
        return /^[A-Za-z .'-]{2,60}$/.test(value.trim());
      }
    },
    {
      id: 'email',
      message: 'Enter a valid email address, such as name@example.com.',
      isValid: function (value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
      }
    },
    {
      id: 'pickup',
      message: 'Choose a pickup date that is today or later.',
      isValid: function (value) {
        if (!value) {
          return false;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const chosen = new Date(value + 'T00:00:00');
        return chosen >= today;
      }
    },
    {
      id: 'request-type',
      message: 'Choose whether this is a pre-order or a general question.',
      isValid: function (value) {
        return value !== '';
      }
    },
    {
      id: 'details',
      message: 'Please enter at least 10 characters describing the items you need.',
      isValid: function (value) {
        return value.trim().length >= 10;
      }
    }
  ];

  function getField(id) {
    return document.getElementById(id);
  }

  function showFieldError(id, message) {
    const field = getField(id);
    const error = document.getElementById(id + '-error');
    error.textContent = message;
    field.classList.add('is-invalid');
    field.setAttribute('aria-invalid', 'true');
  }

  function clearFieldError(id) {
    const field = getField(id);
    const error = document.getElementById(id + '-error');
    error.textContent = '';
    field.classList.remove('is-invalid');
    field.removeAttribute('aria-invalid');
  }

  function validateRule(rule) {
    const valid = rule.isValid(getField(rule.id).value);
    if (valid) {
      clearFieldError(rule.id);
    } else {
      showFieldError(rule.id, rule.message);
    }
    return valid;
  }

  function validateForm() {
    let firstInvalidField = null;
    validationRules.forEach(function (rule) {
      if (!validateRule(rule) && !firstInvalidField) {
        firstInvalidField = getField(rule.id);
      }
    });

    if (firstInvalidField) {
      firstInvalidField.focus();
    }
    return !firstInvalidField;
  }

  function hideSuccess() {
    successMessage.hidden = true;
    successMessage.textContent = '';
  }

  function handleSubmit(event) {
    event.preventDefault(); // There is no server, so keep the page and show feedback.

    if (!validateForm()) {
      hideSuccess();
      return;
    }

    const type = getField('request-type').value;
    successMessage.textContent = 'Thanks! Your ' + (type === 'pre-order' ? 'pre-order request' : 'question') +
      ' passed every check and is ready to send. (This demo does not transmit data to a server.)';
    successMessage.hidden = false;
  }

  function handleLiveValidation(event) {
    const id = event.target.id;
    const rule = validationRules.find(function (item) {
      return item.id === id;
    });

    // Re-check a field only after it has been marked invalid, so users can fix it in place.
    if (rule && getField(id).classList.contains('is-invalid')) {
      validateRule(rule);
    }
    hideSuccess();
  }

  function getShortlistText() {
    return formatShortlistLines(loadShortlist()).join('\n');
  }

  function addShortlistToDetails() {
    const text = getShortlistText();
    if (!text) {
      return;
    }

    const existing = details.value.trim();
    details.value = existing ? existing + '\n' + text : text;
    shortlistNote.hidden = false;
    clearFieldError('details');
    details.focus();
  }

  const savedItems = getShortlistText();
  if (savedItems) {
    details.value = savedItems;
    shortlistNote.hidden = false;
  } else {
    addShortlistButton.disabled = true;
  }

  form.addEventListener('submit', handleSubmit);
  form.addEventListener('input', handleLiveValidation);
  form.addEventListener('change', handleLiveValidation);
  addShortlistButton.addEventListener('click', addShortlistToDetails);
})();
