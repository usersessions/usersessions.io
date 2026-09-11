'use client'

import React, { useRef, useEffect } from 'react'

// ── Types ───────────────────────────────────────────────────────────────────
interface HeatPoint { x: number; y: number }
type Page = 'home' | 'product' | 'cart' | 'checkout' | 'confirmation'
type FrictionType = 'dead' | 'rage' | 'error'

interface SessionEvent {
  t: number; page: Page; label: string; type: string
  x: number | null; y: number | null
}

interface Product {
  id: string; name: string; category: string; desc: string
  price: number; originalPrice?: number; rating: number; reviews: number
  badge?: string; emoji: string
}

interface FrictionDef {
  key: string; page: Page; type: FrictionType
  guaranteed?: boolean
  desc: string
  fixSummary: string
  fixLabel: string; fixToast: [string, string]
}

interface DemoState {
  currentPage: Page; activeProductId: string
  cart: Record<string, number>
  startTime: number; events: SessionEvent[]
  clickCounts: Record<string, number>
  fixed: Record<string, boolean>
  everFlagged: Record<string, boolean>
  activeFrictionKeys: string[]
  heatPoints: Record<Page, HeatPoint[]>
  replaying: boolean
  orderPlaced: boolean
  checkoutStep: 1 | 2 | 3
  selectedSize: string
  selectedColor: string
}

// ── Products ─────────────────────────────────────────────────────────────────
const PRODUCTS: Product[] = [
  { id: 'jacket', name: 'Summit Hardshell', category: "Men's Outerwear", desc: 'Waterproof 3-layer shell. Packable hood. Seam-sealed.', price: 189, rating: 4.6, reviews: 2341, badge: 'Best Seller', emoji: '🧥' },
  { id: 'headphones', name: 'Arc Pro Headphones', category: 'Electronics', desc: 'Adaptive ANC, 40hr battery, spatial audio.', price: 249, originalPrice: 329, rating: 4.8, reviews: 1829, badge: 'Sale', emoji: '🎧' },
  { id: 'sneakers', name: 'Drift Runner', category: "Men's Footwear", desc: 'Responsive foam midsole. Breathable mesh upper.', price: 115, rating: 4.4, reviews: 987, emoji: '👟' },
  { id: 'bag', name: 'Canvas Weekender', category: 'Bags', desc: 'Waxed canvas, leather handles, 40L capacity.', price: 145, rating: 4.7, reviews: 612, badge: 'New', emoji: '🎒' },
]

const SIZES = ['XS','S','M','L','XL']
const COLORS = ['Midnight Black','Slate Grey','Forest Green']

const FRICTION_POOL: FrictionDef[] = [
  {
    key: 'checkout:cardDecline', page: 'checkout', type: 'error', guaranteed: true,
    desc: 'The card form throws a generic "Payment failed" error even when valid card details are entered. No explanation, no retry path — shoppers assume their card is the problem and leave.',
    fixSummary: '✓ Payment error is now specific and actionable — it tells the shopper exactly what to check and offers a one-click retry.',
    fixLabel: 'Fix payment error',
    fixToast: ['Payment error fixed', 'Clear error + retry flow is now live for every visitor.'],
  },
  {
    key: 'checkout:priceInflation', page: 'checkout', type: 'rage', guaranteed: true,
    desc: 'The checkout total is higher than the product page price. No tax or shipping was shown beforehand. Shoppers click the total repeatedly trying to understand the discrepancy, then abandon.',
    fixSummary: '✓ The price breakdown (subtotal, shipping, tax) is now shown at every step — no surprise total at payment.',
    fixLabel: 'Fix price display',
    fixToast: ['Price breakdown fixed', 'Subtotal + shipping now shown before checkout.'],
  },
  {
    key: 'product:sizeOutOfStock', page: 'product', type: 'dead',
    desc: 'Size M shows as selectable but clicking "Add to Cart" immediately says "Out of stock." The selector gives no visual hint it is unavailable before the user tries to buy.',
    fixSummary: '✓ Out-of-stock sizes are now crossed out and unclickable before the shopper even attempts to add them.',
    fixLabel: 'Fix size selector',
    fixToast: ['Size selector fixed', 'OOS sizes are now clearly marked before any click.'],
  },
  {
    key: 'cart:couponRejected', page: 'cart', type: 'error',
    desc: 'The promotional coupon field rejects valid codes with a vague "Invalid code" message. Shoppers who came via a discount link cannot redeem it and feel misled.',
    fixSummary: '✓ Coupon codes are now validated correctly — SHIP100 applies free shipping instantly.',
    fixLabel: 'Fix coupon validation',
    fixToast: ['Coupon fixed', 'Valid codes now accepted and applied immediately.'],
  },
]

const THRESHOLDS: Record<FrictionType, number> = { dead: 2, rage: 3, error: 2 }
const MIN_EVENTS_FOR_REPLAY = 2

export function InteractiveDemo() {
  const mockPageRef    = useRef<HTMLDivElement>(null)
  const pageContentRef = useRef<HTMLDivElement>(null)
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const urlBarRef      = useRef<HTMLSpanElement>(null)
  const cartCountRef   = useRef<HTMLSpanElement>(null)
  const statusCardRef  = useRef<HTMLDivElement>(null)
  const toastRef       = useRef<HTMLDivElement>(null)
  const cursorRef      = useRef<HTMLDivElement>(null)
  const replayBadgeRef = useRef<HTMLSpanElement>(null)
  const restartBtnRef  = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const mockPage    = mockPageRef.current!
    const pageContent = pageContentRef.current!
    const canvas      = canvasRef.current!
    const ctx         = canvas.getContext('2d')!
    const urlBar      = urlBarRef.current!
    const cartCount   = cartCountRef.current!
    const statusCard  = statusCardRef.current!
    const toast       = toastRef.current!
    const cursor      = cursorRef.current!
    const replayBadge = replayBadgeRef.current!
    const restartBtn  = restartBtnRef.current!

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const MOVE_MS  = reduceMotion ? 20 : 420
    const PAUSE_MS = reduceMotion ? 20 : 380

    function urlFor(page: Page, productId: string) {
      if (page === 'home') return 'northfield.store/'
      if (page === 'product') return 'northfield.store/p/' + productId
      if (page === 'cart') return 'northfield.store/cart'
      if (page === 'checkout') return 'northfield.store/checkout'
      return 'northfield.store/order/confirmed'
    }

    function pickActiveFrictions(): string[] {
      const guaranteed = FRICTION_POOL.filter(f => f.guaranteed).map(f => f.key)
      const rotating = FRICTION_POOL.filter(f => !f.guaranteed)
      if (rotating.length === 0) return guaranteed
      const pick = rotating[Math.floor(Math.random() * rotating.length)]
      return [...guaranteed, pick.key]
    }

    function frictionByKey(key: string) { return FRICTION_POOL.find(f => f.key === key)! }
    function activeFriction(s: DemoState, key: string) {
      return s.activeFrictionKeys.includes(key) ? frictionByKey(key) : null
    }

    const freshState = (): DemoState => ({
      currentPage: 'home', activeProductId: PRODUCTS[0].id,
      cart: {}, startTime: Date.now(), events: [],
      clickCounts: {}, fixed: {}, everFlagged: {},
      activeFrictionKeys: pickActiveFrictions(),
      heatPoints: { home: [], product: [], cart: [], checkout: [], confirmation: [] },
      replaying: false, orderPlaced: false, checkoutStep: 1,
      selectedSize: 'M', selectedColor: COLORS[0],
    })

    let state = freshState()
    let replayTimeouts: ReturnType<typeof setTimeout>[] = []

    function cartItemCount() { return Object.values(state.cart).reduce((a, b) => a + b, 0) }
    function cartSubtotal() {
      return Object.entries(state.cart).reduce((sum, [id, qty]) => {
        const p = PRODUCTS.find(pr => pr.id === id)
        return sum + (p ? p.price * qty : 0)
      }, 0)
    }

    function renderStars(rating: number) {
      const full = Math.floor(rating)
      const half = rating % 1 >= 0.5
      let s = ''
      for (let i = 0; i < full; i++) s += '<span class="star full">★</span>'
      if (half) s += '<span class="star half">★</span>'
      for (let i = full + (half ? 1 : 0); i < 5; i++) s += '<span class="star empty">☆</span>'
      return s
    }

    function tHome() {
      return `
        <div class="store-topbar">
          <div class="store-logo" data-page="home">Northfield</div>
          <nav class="store-nav">
            <span data-page="home" class="nav-link">Men</span>
            <span data-page="home" class="nav-link">Women</span>
            <span data-page="home" class="nav-link">Sale</span>
          </nav>
          <div class="store-actions">
            <button class="icon-btn cart-btn" data-page="cart">🛒 <span class="cart-badge">${cartItemCount()}</span></button>
          </div>
        </div>
        <div class="store-banner"><p>Free shipping on orders over $100 · Use code <strong>SHIP100</strong></p></div>
        <div class="product-grid">
          ${PRODUCTS.map(p => `
            <div class="product-card" data-target="product-${p.id}">
              <div class="product-img-wrap">
                <div class="product-emoji-img">${p.emoji}</div>
                ${p.badge ? `<span class="product-badge ${p.badge === 'Sale' ? 'badge-sale' : p.badge === 'New' ? 'badge-new' : ''}">${p.badge}</span>` : ''}
              </div>
              <div class="product-card-body">
                <div class="product-card-cat">${p.category}</div>
                <div class="product-card-name">${p.name}</div>
                <div class="product-card-meta">
                  <div class="product-stars">${renderStars(p.rating)}</div>
                  <span class="product-review-count">(${p.reviews.toLocaleString()})</span>
                </div>
                <div class="product-card-price">
                  ${p.originalPrice ? `<s class="price-original">$${p.originalPrice}</s> ` : ''}
                  <span class="price-current">$${p.price}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>`
    }

    function tProduct() {
      const p = PRODUCTS.find(pr => pr.id === state.activeProductId)!
      const sizeOOSActive = activeFriction(state, 'product:sizeOutOfStock') && !state.fixed['product:sizeOutOfStock']
      const qty = state.cart[p.id] || 0
      return `
        <div class="store-topbar">
          <div class="store-logo" data-page="home">Northfield</div>
          <div class="store-actions"><button class="icon-btn cart-btn" data-page="cart">🛒 <span class="cart-badge">${cartItemCount()}</span></button></div>
        </div>
        <div class="product-detail">
          <button class="back-link" data-page="home">← Back</button>
          <div class="product-detail-layout">
            <div class="product-detail-gallery"><div class="product-detail-emoji">${p.emoji}</div></div>
            <div class="product-detail-info">
              <div class="product-card-cat">${p.category}</div>
              <h2 class="detail-title">${p.name}</h2>
              <div class="detail-rating">
                ${renderStars(p.rating)}
                <span class="reviews-count">${p.rating} · ${p.reviews.toLocaleString()} reviews</span>
              </div>
              <div class="detail-price">
                ${p.originalPrice ? `<s class="price-original">$${p.originalPrice}</s> ` : ''}
                <span class="price-current price-lg">$${p.price}</span>
              </div>
              <p class="detail-desc">${p.desc}</p>
              <div class="option-group">
                <label class="option-label">Colour: <strong>${state.selectedColor}</strong></label>
                <div class="color-options">
                  ${COLORS.map(c => `<button class="color-swatch ${state.selectedColor === c ? 'selected' : ''}" data-target="color-${c.split(' ')[0]}">${c.split(' ')[0]}</button>`).join('')}
                </div>
              </div>
              <div class="option-group">
                <label class="option-label">Size: <strong>${state.selectedSize}</strong>${sizeOOSActive ? ' <span class="oos-hint">— M is out of stock</span>' : ''}</label>
                <div class="size-options">
                  ${SIZES.map(s => `<button class="size-btn ${state.selectedSize === s ? 'selected' : ''} ${sizeOOSActive && s === 'M' && !state.fixed['product:sizeOutOfStock'] ? 'is-oos' : ''}" data-target="size-${s}">${s}</button>`).join('')}
                </div>
              </div>
              <div class="atc-row">
                <button class="atc-btn ${qty > 0 ? 'atc-added' : ''}" data-target="addToCart">
                  ${qty > 0 ? `✓ In cart (${qty})` : 'Add to cart'}
                </button>
                ${qty > 0 ? `<button class="btn btn--ghost view-cart-btn" data-page="cart">View cart →</button>` : ''}
              </div>
            </div>
          </div>
        </div>`
    }

    function tCart() {
      const items = Object.entries(state.cart)
      const couponFixed = !!state.fixed['cart:couponRejected']
      const subtotal = cartSubtotal()
      return `
        <div class="store-topbar"><div class="store-logo" data-page="home">Northfield</div></div>
        <div class="cart-page">
          <h2 class="cart-title">Your Bag (${cartItemCount()})</h2>
          ${items.length === 0
            ? `<div class="cart-empty"><p>Your bag is empty.</p><button class="atc-btn" data-page="home">Continue shopping</button></div>`
            : `
            <div class="cart-items">
              ${items.map(([id, qty]) => {
                const p = PRODUCTS.find(pr => pr.id === id)!
                return `
                  <div class="cart-item">
                    <div class="cart-item-emoji">${p.emoji}</div>
                    <div class="cart-item-info">
                      <div class="cart-item-name">${p.name}</div>
                      <div class="cart-item-meta">Size: ${state.selectedSize} · ${state.selectedColor.split(' ')[0]}</div>
                      <div class="cart-item-qty">
                        <button class="qty-btn" data-target="qty-minus-${id}">−</button>
                        <span>${qty}</span>
                        <button class="qty-btn" data-target="qty-plus-${id}">+</button>
                      </div>
                    </div>
                    <div class="cart-item-price">$${(p.price * qty).toFixed(2)}</div>
                  </div>`
              }).join('')}
            </div>
            <div class="cart-coupon">
              <input class="mock-input" placeholder="Promo or gift code" id="couponInput" value="SHIP100">
              <button class="btn btn--ghost" data-target="coupon">Apply</button>
            </div>
            <p class="coupon-msg" id="couponMsg">${couponFixed ? '<span class="success-msg">✓ SHIP100 applied — free shipping!</span>' : ''}</p>
            <div class="cart-summary">
              <div class="summary-row"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
              <div class="summary-row muted"><span>Shipping</span><span>${couponFixed ? 'Free' : 'Calculated at checkout'}</span></div>
            </div>
            <button class="atc-btn checkout-btn" data-page="checkout">Checkout →</button>
          `}
        </div>`
    }

    function tCheckout() {
      const subtotal = cartSubtotal()
      const priceBugActive = activeFriction(state, 'checkout:priceInflation') && !state.fixed['checkout:priceInflation']
      const hiddenFees = priceBugActive ? Math.max(12, Math.round(subtotal * 0.14)) : 0
      const total = subtotal + hiddenFees
      const cardFixed = !!state.fixed['checkout:cardDecline']
      const cardErrors = state.clickCounts['checkout:cardDecline'] || 0

      const orderSummary = `
        <div class="checkout-order-summary">
          <div class="summary-header">Order summary</div>
          ${Object.entries(state.cart).map(([id, qty]) => {
            const p = PRODUCTS.find(pr => pr.id === id)!
            return `<div class="summary-line"><span>${p.emoji} ${p.name} ×${qty}</span><span>$${(p.price * qty).toFixed(2)}</span></div>`
          }).join('')}
          <div class="summary-divider"></div>
          ${priceBugActive ? `<div class="summary-line warning"><span>⚠ Unexpected fees</span><span>+$${hiddenFees.toFixed(2)}</span></div>` : ''}
          <div class="summary-line total-line"><span>Total</span><span>$${total.toFixed(2)}</span></div>
        </div>`

      if (state.checkoutStep === 1) {
        return `
          <div class="checkout-page">
            <div class="checkout-header">
              <div class="store-logo" data-page="home">Northfield</div>
              <div class="checkout-steps"><span class="step active">Contact</span><span class="step-sep">›</span><span class="step">Shipping</span><span class="step-sep">›</span><span class="step">Payment</span></div>
            </div>
            <div class="checkout-body">
              <div class="checkout-form">
                <h3 class="checkout-section-title">Contact</h3>
                <input class="mock-input full-width" placeholder="Email" value="alex@example.com">
                <div class="input-row">
                  <input class="mock-input half" placeholder="First name" value="Alex">
                  <input class="mock-input half" placeholder="Last name" value="Morgan">
                </div>
                <button class="atc-btn" data-target="checkout-step2">Continue to shipping →</button>
              </div>
              ${orderSummary}
            </div>
          </div>`
      }

      if (state.checkoutStep === 2) {
        return `
          <div class="checkout-page">
            <div class="checkout-header">
              <div class="store-logo" data-page="home">Northfield</div>
              <div class="checkout-steps"><span class="step done">✓ Contact</span><span class="step-sep">›</span><span class="step active">Shipping</span><span class="step-sep">›</span><span class="step">Payment</span></div>
            </div>
            <div class="checkout-body">
              <div class="checkout-form">
                <h3 class="checkout-section-title">Shipping address</h3>
                <input class="mock-input full-width" placeholder="Address" value="42 Maple Street">
                <div class="input-row">
                  <input class="mock-input half" placeholder="City" value="Brooklyn">
                  <input class="mock-input half" placeholder="Postcode" value="NY 11201">
                </div>
                <div class="shipping-options">
                  <label class="shipping-opt selected">📦 Standard · 5–7 days · <strong>Free</strong></label>
                  <label class="shipping-opt">⚡ Express · 2 days · <strong>$9.99</strong></label>
                </div>
                <button class="atc-btn" data-target="checkout-step3">Continue to payment →</button>
              </div>
              ${orderSummary}
            </div>
          </div>`
      }

      // Step 3: Payment
      return `
        <div class="checkout-page">
          <div class="checkout-header">
            <div class="store-logo" data-page="home">Northfield</div>
            <div class="checkout-steps"><span class="step done">✓ Contact</span><span class="step-sep">›</span><span class="step done">✓ Shipping</span><span class="step-sep">›</span><span class="step active">Payment</span></div>
          </div>
          <div class="checkout-body">
            <div class="checkout-form">
              <h3 class="checkout-section-title">Payment</h3>
              <input class="mock-input full-width" placeholder="Card number" value="4242 4242 4242 4242">
              <div class="input-row">
                <input class="mock-input half" placeholder="MM / YY" value="12 / 27">
                <input class="mock-input half" placeholder="CVV" value="•••">
              </div>
              ${!cardFixed && cardErrors >= 1 ? `<p class="payment-error">✕ Payment failed. Please check your card details and try again.</p>` : ''}
              <div class="checkout-total-row ${priceBugActive ? 'is-mismatch' : ''}" data-target="priceMismatch">
                <span>You will be charged</span>
                <strong class="checkout-total-amount">$${total.toFixed(2)}</strong>
              </div>
              ${priceBugActive ? `<p class="price-warning">⚠ Total is $${hiddenFees} more than shown on the product page</p>` : ''}
              <button class="atc-btn place-order-btn ${!cardFixed && cardErrors >= THRESHOLDS.error - 1 ? 'is-flagged' : ''}" data-target="placeOrder">
                Place order — $${total.toFixed(2)}
              </button>
              <p class="checkout-secure">🔒 256-bit SSL encrypted</p>
            </div>
            ${orderSummary}
          </div>
        </div>`
    }

    function tConfirmation() {
      return `
        <div class="confirmation-page">
          <div class="confirm-icon">✅</div>
          <h2 class="confirm-title">Order confirmed!</h2>
          <p class="confirm-sub">Order #NF-${Math.floor(10000 + Math.random() * 90000)}</p>
          <p class="confirm-sub">Confirmation sent to alex@example.com</p>
          <div class="confirm-items">
            ${Object.entries(state.cart).map(([id, qty]) => {
              const p = PRODUCTS.find(x => x.id === id)!
              return `<div class="confirm-item">${p.emoji} ${p.name} ×${qty}</div>`
            }).join('')}
          </div>
          <div class="confirm-delivery">
            <p>📦 Estimated delivery: <strong>Sep 4 – Sep 6</strong></p>
            <p>📍 42 Maple Street, Brooklyn, NY 11201</p>
          </div>
          <button class="btn btn--ghost" data-page="home" style="margin-top:16px;">Continue shopping</button>
        </div>`
    }

    const TEMPLATES: Record<Page, () => string> = { home: tHome, product: tProduct, cart: tCart, checkout: tCheckout, confirmation: tConfirmation }

    function renderPageContent() { pageContent.innerHTML = TEMPLATES[state.currentPage]() }
    function updateUrlBar() { urlBar.textContent = urlFor(state.currentPage, state.activeProductId) }
    function updateCartBadge() { if (cartCount) cartCount.textContent = String(cartItemCount()) }

    function sizeCanvas() {
      const r = mockPage.getBoundingClientRect()
      canvas.width = r.width; canvas.height = r.height
    }
    function drawHeatPoint(x: number, y: number) {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 40)
      grad.addColorStop(0, 'rgba(255,90,31,0.25)')
      grad.addColorStop(1, 'rgba(255,90,31,0)')
      ctx.fillStyle = grad
      ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI * 2); ctx.fill()
    }
    function redrawHeat() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ;(state.heatPoints[state.currentPage] || []).forEach(p => drawHeatPoint(p.x, p.y))
    }

    function goToPage(page: Page, productId?: string) {
      if (productId) state.activeProductId = productId
      state.currentPage = page
      if (page === 'checkout') state.checkoutStep = 1
      renderPageContent(); updateUrlBar()
      requestAnimationFrame(() => { sizeCanvas(); redrawHeat() })
    }

    function showToast(msg: string, sub?: string) {
      toast.innerHTML = msg + (sub ? `<small>${sub}</small>` : '')
      toast.classList.add('show')
      setTimeout(() => toast.classList.remove('show'), 3400)
    }
    function fmtTime(ms: number) { return '0:' + String(Math.floor(ms / 1000)).padStart(2, '0') }

    function renderIdle() {
      statusCard.innerHTML = `
        <p class="status-idle">&gt; watching for a visitor<span class="caret"></span></p>
        <p class="status-idle-hint">Browse the store like a real shopper. Pick a product, add it to your cart, try to check out.</p>
        <p class="status-idle-hint" style="margin-top: 12px; line-height: 1.5;">A heatmap shows you where people clicked. A session replay shows you what they did, second by second. Neither one tells you why they left, or what to do about it. So you end up watching recordings, taking notes, and still guessing. A tool that shows you a problem and walks away isn't finished. It just moved the work onto your desk.</p>`
    }

    function renderActive() {
      const recent = state.events.slice(-5)
      const lines = recent.map(ev => `<li class="${ev.type !== 'normal' ? 'is-friction' : ''}">${fmtTime(ev.t)} — ${ev.label}</li>`).join('')
      const enabled = state.events.length >= MIN_EVENTS_FOR_REPLAY
      statusCard.innerHTML = `
        <p class="kicker-mini">Your session so far</p>
        <ul class="session-log">${lines}</ul>
        <p class="session-count">${state.events.length} action${state.events.length === 1 ? '' : 's'} captured</p>
        <button class="btn btn--dark" id="replayBtn" ${enabled ? '' : 'disabled'}>Watch your replay →</button>`
      statusCard.querySelector('#replayBtn')?.addEventListener('click', startReplay)
    }

    function renderReplaying() {
      statusCard.innerHTML = `
        <p class="kicker-mini">Replaying your session</p>
        <ul class="session-log" id="replayLog"></ul>
        <p class="restart-line" style="margin-top:auto;"><button id="skipBtn" type="button">Skip to results →</button></p>`
      statusCard.querySelector('#skipBtn')?.addEventListener('click', () => finishReplay())
    }

    function renderFindings() {
      const flaggedKeys = state.activeFrictionKeys.filter(k => state.everFlagged[k])
      if (flaggedKeys.length === 0) {
        statusCard.innerHTML = `
          <p class="kicker-mini">What your session shows</p>
          <p class="empty-note">Nothing flagged yet — try adding a product and going all the way through checkout.</p>
          <p class="restart-line"><button id="backBtn" type="button">Back to the store</button></p>`
        statusCard.querySelector('#backBtn')?.addEventListener('click', renderActive)
        return
      }
      const allFixed = flaggedKeys.every(k => state.fixed[k])
      statusCard.innerHTML = `
        <p class="kicker-mini">What your session shows</p>
        <div class="findings-list">
          ${flaggedKeys.map(key => {
            const def = frictionByKey(key)
            const fixed = !!state.fixed[key]
            return `
              <div class="finding-item ${fixed ? 'is-fixed' : ''}" data-key="${key}">
                ${fixed
                  ? `<div class="fix-success">
                      <span class="fix-success-icon">✓</span>
                      <p class="fix-success-text">${def.fixSummary}</p>
                    </div>`
                  : `<p class="finding-desc">${def.desc}</p>
                     <button class="btn btn--primary fix-btn" data-fix="${key}">${def.fixLabel}</button>`
                }
              </div>`
          }).join('')}
        </div>
        ${allFixed ? `
          <div class="wrapup">That's the whole loop: watch, understand, fix. Leave this page and it resets — the next visitor gets a different mix of problems.</div>
          <div class="post-demo-cta">
            <p class="post-demo-label">Ready to see this on your own site?</p>
            <a class="btn btn--ember post-demo-btn" href="/login">Connect your site →</a>
            <p class="post-demo-note">One script. Free to start. No card required.</p>
          </div>` : ''}
        <p class="restart-line"><button id="restartFromFindings" type="button">↺ Restart the demo</button></p>`
      statusCard.querySelectorAll<HTMLElement>('[data-fix]').forEach(b =>
        b.addEventListener('click', () => runFix(b.dataset.fix!))
      )
      statusCard.querySelector('#restartFromFindings')?.addEventListener('click', resetDemo)
    }

    function logEvent({ label, type, el }: { label: string; type?: string; el?: Element | null }) {
      let x: number | null = null, y: number | null = null
      if (el) {
        const pr = mockPage.getBoundingClientRect(), er = el.getBoundingClientRect()
        x = er.left - pr.left + er.width / 2
        y = er.top - pr.top + er.height / 2
        state.heatPoints[state.currentPage].push({ x, y })
        drawHeatPoint(x, y)
      }
      state.events.push({ t: Date.now() - state.startTime, page: state.currentPage, label, type: type || 'normal', x, y })
      if (!state.replaying) renderActive()
    }

    function incrementFriction(key: string, el: Element | null, label: string) {
      const def = frictionByKey(key)
      state.clickCounts[key] = (state.clickCounts[key] || 0) + 1
      const count = state.clickCounts[key]
      logEvent({ label: count > 1 ? label + ' again' : label, type: def.type, el })
      if (count >= THRESHOLDS[def.type] - 1 && el) el.classList.add('is-flagged')
      if (count >= THRESHOLDS[def.type]) state.everFlagged[key] = true
    }

    function isActive(key: string) { return state.activeFrictionKeys.includes(key) && !state.fixed[key] }

    function handleClick(e: MouseEvent) {
      if (state.replaying) return

      const navEl = (e.target as Element).closest<HTMLElement>('[data-page]')
      if (navEl) {
        const page = navEl.dataset.page as Page
        logEvent({ label: 'Went to ' + page, type: 'normal', el: navEl })
        goToPage(page)
        return
      }

      const target = (e.target as Element).closest<HTMLElement>('[data-target]')
      if (!target) return
      const key = target.dataset.target!

      if (key.startsWith('product-')) {
        const id = key.replace('product-', '')
        logEvent({ label: 'Opened ' + PRODUCTS.find(p => p.id === id)?.name, type: 'normal', el: target })
        goToPage('product', id)
      } else if (key.startsWith('size-')) {
        const size = key.replace('size-', '')
        state.selectedSize = size
        if (isActive('product:sizeOutOfStock') && size === 'M') {
          logEvent({ label: `Selected size ${size}`, type: 'normal', el: target })
          renderPageContent()
          setTimeout(() => {
            incrementFriction('product:sizeOutOfStock', mockPage.querySelector('.atc-btn'), `Tried to add size M — out of stock`)
            renderPageContent()
          }, 300)
        } else {
          logEvent({ label: `Selected size ${size}`, type: 'normal', el: target })
          renderPageContent()
        }
      } else if (key.startsWith('color-')) {
        const colorWord = key.replace('color-', '')
        state.selectedColor = COLORS.find(c => c.startsWith(colorWord)) || COLORS[0]
        logEvent({ label: `Selected colour: ${state.selectedColor}`, type: 'normal', el: target })
        renderPageContent()
      } else if (key === 'addToCart') {
        if (isActive('product:sizeOutOfStock') && state.selectedSize === 'M') {
          incrementFriction('product:sizeOutOfStock', target, 'Add to cart — size M out of stock')
          renderPageContent()
        } else {
          state.cart[state.activeProductId] = (state.cart[state.activeProductId] || 0) + 1
          logEvent({ label: 'Added ' + PRODUCTS.find(p => p.id === state.activeProductId)?.name + ' to cart', type: 'normal', el: target })
          updateCartBadge(); renderPageContent()
          showToast('Added to bag ✓', '')
        }
      } else if (key.startsWith('qty-')) {
        // key format: qty-minus-productid or qty-plus-productid
        // Use indexOf to safely handle product IDs with hyphens
        const isPlus = key.startsWith('qty-plus-')
        const id = key.slice(isPlus ? 'qty-plus-'.length : 'qty-minus-'.length)
        if (!state.cart[id]) return
        if (isPlus) {
          state.cart[id]++
          logEvent({ label: `Increased qty for ${PRODUCTS.find(p => p.id === id)?.name}`, type: 'normal', el: target })
        } else {
          state.cart[id]--
          if (state.cart[id] <= 0) delete state.cart[id]
          logEvent({ label: `Decreased qty for ${PRODUCTS.find(p => p.id === id)?.name}`, type: 'normal', el: target })
        }
        updateCartBadge(); renderPageContent()
      } else if (key === 'coupon') {
        const msgEl = mockPage.querySelector<HTMLElement>('#couponMsg')
        if (isActive('cart:couponRejected')) {
          if (msgEl) { msgEl.innerHTML = '<span class="error-msg">✕ Invalid code. Please try another.</span>' }
          incrementFriction('cart:couponRejected', target, 'Applied coupon — rejected')
        } else {
          if (msgEl) { msgEl.innerHTML = '<span class="success-msg">✓ SHIP100 applied — free shipping!</span>' }
          logEvent({ label: 'Applied promo code SHIP100', type: 'normal', el: target })
        }
      } else if (key === 'priceMismatch') {
        if (isActive('checkout:priceInflation')) {
          incrementFriction('checkout:priceInflation', target, 'Tapped the total — price looks wrong')
        }
      } else if (key === 'checkout-step2') {
        state.checkoutStep = 2
        logEvent({ label: 'Entered shipping details', type: 'normal', el: target })
        renderPageContent()
      } else if (key === 'checkout-step3') {
        state.checkoutStep = 3
        logEvent({ label: 'Entered payment details', type: 'normal', el: target })
        renderPageContent()
      } else if (key === 'placeOrder') {
        if (Object.keys(state.cart).length === 0) return
        if (isActive('checkout:cardDecline')) {
          incrementFriction('checkout:cardDecline', target, 'Clicked Place Order — payment failed')
          target.classList.add('shake')
          setTimeout(() => { target.classList.remove('shake'); renderPageContent() }, 700)
        } else {
          logEvent({ label: 'Placed the order ✓', type: 'normal', el: target })
          state.orderPlaced = true
          state.cart = {}
          goToPage('confirmation')
          showToast('Order placed!', 'Thanks, Alex.')
        }
      }
    }

    function runFix(key: string) {
      const def = frictionByKey(key)
      const row = statusCard.querySelector(`.finding-item[data-key="${key}"]`)
      // Show a clear "deploying fix" interim state — NOT the problem description
      if (row) row.innerHTML = `
        <div class="fix-deploying">
          <span class="fix-deploying-spinner"></span>
          <p class="fix-deploying-text">Applying fix across all live sessions…</p>
        </div>`
      replayTimeouts.push(setTimeout(() => {
        state.fixed[key] = true
        renderPageContent(); updateCartBadge(); renderFindings()
        showToast(...def.fixToast)
      }, reduceMotion ? 40 : 1200))
    }

    function startReplay() {
      if (state.events.length === 0) return
      state.replaying = true
      mockPage.classList.add('is-replaying')
      replayBadge.classList.add('show')
      renderReplaying()
      let replayPage: Page | null = null
      let i = 0
      const seq = state.events.slice()
      function step() {
        if (i >= seq.length) { finishReplay(); return }
        const ev = seq[i]
        if (ev.page !== replayPage) {
          replayPage = ev.page
          state.currentPage = ev.page
          renderPageContent(); updateUrlBar()
          requestAnimationFrame(() => { sizeCanvas(); redrawHeat() })
        }
        if (ev.x !== null) {
          cursor.classList.add('show')
          cursor.style.left = ev.x + 'px'
          cursor.style.top  = ev.y + 'px'
        }
        replayTimeouts.push(setTimeout(() => {
          if (ev.x !== null) spawnRipple(ev.x!, ev.y!, ev.type)
          cursor.classList.add('is-clicking')
          replayTimeouts.push(setTimeout(() => cursor.classList.remove('is-clicking'), 120))
          const log = statusCard.querySelector('#replayLog')
          const li  = document.createElement('li')
          li.className   = ev.type !== 'normal' ? 'is-friction' : ''
          li.textContent = fmtTime(ev.t) + ' — ' + ev.label
          if (log) { log.appendChild(li); (log as HTMLElement).scrollTop = log.scrollHeight }
          i++
          replayTimeouts.push(setTimeout(step, PAUSE_MS))
        }, MOVE_MS))
      }
      step()
    }

    function spawnRipple(x: number, y: number, type: string) {
      const r = document.createElement('div')
      r.className  = 'ripple'
      r.style.left = x + 'px'
      r.style.top  = y + 'px'
      if (type !== 'normal') r.style.borderColor = 'var(--ember)'
      mockPage.appendChild(r)
      setTimeout(() => r.remove(), 700)
      const el = document.elementFromPoint(mockPage.getBoundingClientRect().left + x, mockPage.getBoundingClientRect().top + y) as HTMLElement | null
      const clickable = el?.closest<HTMLElement>('button, [data-target], [data-page]')
      if (clickable) { clickable.classList.add('mock-active'); setTimeout(() => clickable.classList.remove('mock-active'), 150) }
    }

    function finishReplay() {
      replayTimeouts.forEach(clearTimeout); replayTimeouts = []
      state.replaying = false
      mockPage.classList.remove('is-replaying')
      replayBadge.classList.remove('show')
      cursor.classList.remove('show')
      renderFindings()
    }

    function resetDemo() {
      replayTimeouts.forEach(clearTimeout); replayTimeouts = []
      state = freshState()
      renderPageContent(); updateUrlBar(); updateCartBadge()
      requestAnimationFrame(() => { sizeCanvas(); redrawHeat() })
      renderIdle()
      toast.classList.remove('show')
      replayBadge.classList.remove('show')
      cursor.classList.remove('show')
    }

    const handleResize           = () => { sizeCanvas(); redrawHeat() }
    const handleVisibilityChange = () => { if (document.hidden) resetDemo() }

    mockPage.addEventListener('click', handleClick)
    window.addEventListener('resize', handleResize)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    restartBtn.addEventListener('click', resetDemo)

    renderPageContent(); updateUrlBar(); updateCartBadge(); sizeCanvas(); renderIdle()

    return () => {
      mockPage.removeEventListener('click', handleClick)
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      replayTimeouts.forEach(clearTimeout)
    }
  }, [])

  return (
    <>
      <div className="demo">
        <div className="browser">
          <div className="browser-bar">
            <span className="browser-dot" />
            <span className="browser-dot" />
            <span className="browser-dot" />
            <span ref={urlBarRef} className="browser-url">northfield.store/</span>
            <span ref={replayBadgeRef} className="replay-badge">REPLAYING</span>
          </div>
          <div ref={mockPageRef} className="mock-page">
            <canvas ref={canvasRef} className="heat-canvas" />
            <div ref={pageContentRef} />
            <div ref={toastRef} className="toast" />
            <div ref={cursorRef} className="replay-cursor" />
          </div>
          <p className="demo-hint">Sample store. Nothing is saved once you leave.</p>
        </div>
        <div className="side-panel">
          <div ref={statusCardRef} className="status-card" />
        </div>
      </div>
      <span ref={cartCountRef} style={{ display: 'none' }} />
      <p className="demo-caption">
        On your real store, this runs on its own. No one has to click a replay button for it to work,
        and nothing acts without a rule you set first.
      </p>
      <p className="restart-line">
        <button ref={restartBtnRef} type="button">↺ Restart the demo</button>
      </p>
    </>
  )
}
