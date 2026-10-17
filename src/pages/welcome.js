/* =====================================================================
   WELCOME PAGE: Rotating Daily Bible Verse & Faith Foundation Prompts
   ===================================================================== */
import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { S } from '../core/store.js';
import { A } from '../actions/actions.js';
import { getActiveBibleVerse } from '../features/bible-verse.js';
import { PRAYER_STATE, playSituationPrayer } from '../features/gemini-prayer.js';
import { render } from '../shell/render.js';

export const WELCOME_EXAMPLES = [
  {
    id: 'morning-prayer',
    title: 'Morning prayer',
    desc: 'Listen to an uplifting, peaceful prayer generated with Gemini AI',
    image: '/morning-prayer.jpg',
    action: 'prayer',
  },
  {
    id: 'strength-guidance',
    title: 'Strength and focus',
    desc: 'Seek peace and clarity amidst deadlines and complex tasks',
    image: '/strength-focus.jpg',
    action: 'prayer',
  },
  {
    id: 'peace-rest',
    title: 'Peace and restful mind',
    desc: 'Cast all your anxieties upon Him, for He cares for you',
    image: '/peace-rest.jpg',
    action: 'prayer',
  },
  {
    id: 'gratitude-journal',
    title: 'Evening thanksgiving',
    desc: 'Give thanks for victories, answered prayers, and growth today',
    image: '/evening-thanksgiving.jpg',
    action: 'prayer',
  },
];

export function pageWelcome() {
  const verse = getActiveBibleVerse();
  const isPrayerLoading = PRAYER_STATE.isLoading;
  const isPrayerPlaying = PRAYER_STATE.isPlaying;
  const isPrayOpen = !!S.ui.welcomePrayOpen || isPrayerLoading || isPrayerPlaying;

  return `<div class="page flush" style="display:flex;flex-direction:column;height:100%;min-height:100%;position:relative;background:var(--bg);overflow:hidden">
    <!-- SideRays Background Light Shimmer (React Bits) -->
    <div id="welcome-rays" class="side-rays welcome-rays-bg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"></div>

    <!-- Centered Clean Linear-Style View with smooth layout transition -->
    <div id="welcome-center-content" class="welcome-center-content ${isPrayOpen ? 'is-open' : ''}">
      
      <!-- Verse Block (Animates upward smoothly when pray cards expand) -->
      <div class="welcome-verse-block">
        <!-- Prominent Rotating Bible Verse (YourVision API) -->
        <a
          href="${esc(verse.url)}"
          target="_blank"
          rel="noopener noreferrer"
          class="agent-verse-headline"
          aria-label="Read ${esc(verse.ref)} on Bible.com"
          style="margin-bottom:20px"
        >
          <h1>“${esc(verse.text)}”</h1>
          <div class="agent-verse-ref">${esc(verse.ref)}</div>
        </a>

        <!-- Pray Button Under Verse (No icons, clean text) -->
        <div style="margin-bottom:28px;display:flex;align-items:center;justify-content:center">
          <button
            id="pray-toggle-btn"
            class="pray-toggle-btn"
            data-a="togglePrayCards"
            aria-expanded="${isPrayOpen}"
          >
            <span>${isPrayOpen ? 'Hide prayers' : 'Pray'}</span>
          </button>
        </div>
      </div>

      <!-- Curated Example Options / Devotional Cards (Smooth Fade & Expand) -->
      <div id="welcome-cards-wrap" class="welcome-cards-wrap">
        ${
          isPrayerPlaying
            ? `<div style="width:100%;margin-bottom:12px;display:flex;justify-content:flex-end"><span class="badge accent" style="display:inline-flex;align-items:center;gap:5px;font-size:11px">${ic('volume-2', 12)}Playing ${esc(PRAYER_STATE.activeTitle || 'Prayer')}</span></div>`
            : ''
        }

        <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:14px;width:100%">
          ${WELCOME_EXAMPLES.map(ex => {
            const isThisActive = PRAYER_STATE.activeId === ex.id;
            const cardLoading = isThisActive && isPrayerLoading;
            const cardPlaying = isThisActive && isPrayerPlaying;

            let displayTitle = ex.title;

            if (cardLoading) {
              displayTitle = 'Preparing prayer…';
            } else if (cardPlaying) {
              displayTitle = `Playing ${ex.title}`;
            }

            const photoHtml = ex.image
              ? `<img src="${esc(ex.image)}" alt="${esc(displayTitle)}" style="width:100%;height:100%;object-fit:cover;display:block;transition:opacity 0.2s ease" />`
              : `<div class="preset-photo-placeholder" style="width:100%;height:100%;background:linear-gradient(145deg, var(--surface-2), var(--surface-3));display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">
                  <div style="position:absolute;inset:0;background:radial-gradient(circle at 30% 30%, rgba(255,255,255,0.04), transparent 70%)"></div>
                </div>`;

            return `
            <div
              class="example-card ${cardLoading ? 'is-loading' : ''} ${cardPlaying ? 'is-playing' : ''}"
              data-a="openWelcomePrompt"
              data-id="${esc(ex.id)}"
              role="button"
              tabindex="0"
              aria-disabled="${cardLoading}"
              style="width:100%;aspect-ratio:2 / 3;position:relative;background:var(--surface);border:none;border-radius:var(--r-lg);overflow:hidden;cursor:${cardLoading ? 'wait' : 'pointer'};display:flex;flex-direction:column;justify-content:flex-end;text-align:left;transition:opacity 0.25s ease, transform 0.25s ease;opacity:${cardLoading ? '0.75' : '1'};pointer-events:${cardLoading ? 'none' : 'auto'}"
              onmouseover="if(!${cardLoading}){this.style.opacity='0.92'}"
              onmouseout="if(!${cardLoading}){this.style.opacity='1'}"
            >
              <!-- 2:3 Background Photo / Texture Layer -->
              <div style="position:absolute;inset:0;width:100%;height:100%;z-index:0;overflow:hidden">
                ${photoHtml}
              </div>

              <!-- Clean Dark Vignette for Text Legibility -->
              <div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 35%, transparent 70%);z-index:1;pointer-events:none"></div>

              <!-- Loading / Playing Overlays -->
              ${cardLoading ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;color:var(--accent);z-index:3"><span class="spin" style="display:inline-flex">${ic('loader-2', 24)}</span></div>` : ''}
              ${cardPlaying ? `<div style="position:absolute;top:10px;right:10px;background:var(--accent);color:#000;border-radius:4px;padding:2px 7px;font-size:10px;font-weight:600;display:flex;align-items:center;gap:4px;z-index:3">${ic('volume-2', 11)}LIVE</div>` : ''}

              <!-- Clean Title Only at Bottom -->
              <div style="position:relative;z-index:2;padding:12px 14px">
                <div style="font-size:13px;font-weight:600;color:#ffffff;line-height:1.3;letter-spacing:-0.01em;text-shadow:0 1px 2px rgba(0,0,0,0.7)">${esc(displayTitle)}</div>
              </div>
            </div>
          `;
          }).join('')}
        </div>
      </div>

    </div>
  </div>`;
}

// Action handler for clicking Pray toggle button: smoothly animates via DOM without rebuilding page or restarting background animation
A.togglePrayCards = () => {
  S.ui.welcomePrayOpen = !S.ui.welcomePrayOpen;
  const container = document.getElementById('welcome-center-content');
  const btn = document.getElementById('pray-toggle-btn');
  if (container && btn) {
    if (S.ui.welcomePrayOpen) {
      container.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      btn.innerHTML = '<span>Hide prayers</span>';
    } else {
      container.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = '<span>Pray</span>';
    }
  } else {
    render();
  }
};

// Action handler for clicking welcome prompt cards
A.openWelcomePrompt = async el => {
  const item = WELCOME_EXAMPLES.find(x => x.id === el.dataset.id);
  if (!item) return;

  if (item.action === 'prayer') {
    // Generate and play situation-focused audio via Gemini 3.8 Flash + TTS
    await playSituationPrayer(item.id, item.title, () => render());
    return;
  }

  // If user wants to open the Bible verse online
  if (item.action === 'verse') {
    const verse = getActiveBibleVerse();
    if (verse?.url) window.open(verse.url, '_blank', 'noopener,noreferrer');
  } else {
    // Navigate to new task or modal
    A.newTask({ dataset: { title: item.title } });
  }
};
