/* =====================================================================
   AGENTS: Linear-Style AI Agent Command Center (Revelation Fintech)
   Seamless shell integration, centered prompt capsule, and instant answers.
   ===================================================================== */
import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { S } from '../core/store.js';
import { go, render } from '../shell/render.js';
import { A, IN, KEY } from '../actions/actions.js';

export const AGENTS_LIST = [
  {
    id: 'agent',
    name: 'Revelation Agent',
    role: 'Autonomous Project & Intelligence Partner',
    tagline: 'Turn ideas into structured projects, research queries, and plan execution.',
    icon: 'sparkles',
    color: '#8e9af3',
    placeholder: 'Ask Revelation...',
    examples: [
      {
        title: 'Create a new project',
        desc: 'Turn an idea into a well-scoped project roadmap',
        icon: 'folder-plus',
        prompt: 'Create a new project roadmap for automated fintech KYC verification pipeline',
      },
      {
        title: 'Research a topic',
        desc: 'Research market liquidity benchmarks and compliance',
        icon: 'search',
        prompt: 'Research interchange fee compression trends and compare Stripe vs Adyen',
      },
      {
        title: 'Set up new team',
        desc: 'Organize permissions and workflows for your team',
        icon: 'users',
        prompt: 'Help me configure a specialized Quantitative Risk & Compliance team workflow',
      },
    ],
  },
];

// Ephemeral in-memory state
export const agentsState = {
  messages: [],
  inputDraft: '',
  isThinking: false,
};

export function pageAgents() {
  const agent = AGENTS_LIST[0];
  const msgs = agentsState.messages;
  const thinking = agentsState.isThinking;

  return `<div class="page flush" style="display:flex;flex-direction:column;height:100%;min-height:100%;position:relative;background:var(--bg)">
    <!-- Subtle Ambient Center Watermark (Linear style) -->
    <div style="position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;opacity:0.035;overflow:hidden">
      <svg width="420" height="420" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.8">
        <circle cx="12" cy="12" r="10"/>
        <path d="m4.93 4.93 4.24 4.24"/>
        <path d="m14.83 9.17 4.24-4.24"/>
        <path d="m14.83 14.83 4.24 4.24"/>
        <path d="m9.17 14.83-4.24 4.24"/>
        <circle cx="12" cy="12" r="4"/>
      </svg>
    </div>

    ${
      !msgs.length
        ? `<!-- Centered Linear-Style Command View -->
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px var(--gutter);max-width:720px;width:100%;margin:0 auto;z-index:2">
          
          <!-- Large Input Capsule -->
          <div style="width:100%;background:var(--surface);border:1px solid var(--border-strong);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,0.45);padding:14px 16px;display:flex;flex-direction:column;gap:12px;transition:border-color var(--dur)">
            <textarea
              id="agents-input"
              class="textarea"
              placeholder="${esc(agent.placeholder)}"
              rows="2"
              data-in="agentsDraft"
              data-key-enter="submitAgentChat"
              style="width:100%;background:transparent;border:none;padding:0;outline:none;resize:none;font-size:15px;line-height:1.5;color:var(--text);caret-color:var(--accent)"
            >${esc(agentsState.inputDraft || '')}</textarea>

            <div class="row" style="align-items:center;justify-content:space-between;padding-top:4px">
              <div class="row" style="gap:6px">
                <button class="btn btn-secondary btn-xs" style="font-size:12px;padding:3px 8px;border-radius:6px;gap:5px;background:var(--surface-2);border:1px solid var(--border)">
                  ${ic('sparkles', 12)}
                  <span>Skills</span>
                  <span style="opacity:0.6">${ic('chevron-down', 11)}</span>
                </button>
              </div>

              <div class="row" style="gap:6px">
                <button class="ibtn ibtn-xs" style="color:var(--text-3);border-radius:6px" data-tip="Attach context" aria-label="Attach context">
                  ${ic('paperclip', 13)}
                </button>
                <button
                  class="ibtn ibtn-sm"
                  data-a="submitAgentChat"
                  style="width:26px;height:26px;border-radius:7px;background:${agentsState.inputDraft?.trim() ? 'var(--accent)' : 'var(--surface-3)'};color:${agentsState.inputDraft?.trim() ? 'var(--on-accent)' : 'var(--text-4)'};display:grid;place-items:center;transition:background var(--dur)"
                  aria-label="Send"
                >
                  ${ic('arrow-up', 14)}
                </button>
              </div>
            </div>
          </div>

          <!-- Examples Header -->
          <div style="width:100%;margin-top:28px;display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <span class="faint" style="font-size:12px;font-weight:500;letter-spacing:0.02em">Get started with some examples</span>
            <span class="faint" style="font-size:11px;color:var(--text-4)">Session only · Instant answers</span>
          </div>

          <!-- 3-Column Example Prompt Cards -->
          <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;width:100%">
            ${agent.examples
              .map(
                ex => `
              <div
                class="example-card"
                data-a="sendSuggestedPrompt"
                data-prompt="${esc(ex.prompt)}"
                role="button"
                tabindex="0"
                style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px;cursor:pointer;display:flex;flex-direction:column;gap:8px;text-align:left;transition:background var(--dur), border-color var(--dur);box-shadow:var(--shadow-sm)"
                onmouseover="this.style.borderColor='var(--border-strong)';this.style.background='var(--surface-2)'"
                onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--surface)'"
              >
                <div style="color:var(--text-3)">${ic(ex.icon, 15)}</div>
                <div style="font-size:13px;font-weight:500;color:var(--text);line-height:1.3">${esc(ex.title)}</div>
                <div class="faint" style="font-size:11.5px;line-height:1.4">${esc(ex.desc)}</div>
              </div>
            `,
              )
              .join('')}
          </div>
        </div>`
        : `<!-- Active Conversation View -->
        <header class="ph" style="padding:0 var(--gutter);height:48px;display:flex;align-items:center;border-bottom:1px solid var(--border);background:transparent;z-index:2">
          <div class="row" style="gap:8px">
            <span style="color:var(--accent)">${ic('sparkles', 15)}</span>
            <span style="font-weight:600;font-size:13.5px;color:var(--text)">Revelation Agent</span>
            <span class="badge" style="font-size:10px;padding:1px 6px">Active Session</span>
          </div>

          <div class="acts" style="margin-left:auto">
            <button class="btn btn-secondary btn-sm" data-a="clearAgentChat" style="font-size:12px;padding:3px 10px;gap:5px">
              ${ic('plus', 12)}New chat
            </button>
          </div>
        </header>

        <div id="agents-chat-body" style="flex:1;overflow-y:auto;padding:24px var(--gutter);display:flex;flex-direction:column;gap:20px;scrollbar-width:thin;z-index:2">
          ${msgs
            .map(m => {
              const isUser = m.role === 'user';
              return `<div style="display:flex;flex-direction:column;align-items:${isUser ? 'flex-end' : 'flex-start'};max-width:760px;margin:0 auto;width:100%">
                <div class="row" style="gap:6px;margin-bottom:4px;font-size:11px;color:var(--text-3)">
                  ${
                    isUser
                      ? `<span>You</span><span>·</span><span>${m.time}</span>`
                      : `<span style="color:var(--accent);font-weight:500">Revelation Agent</span><span>·</span><span>${m.time}</span>`
                  }
                </div>
                <div style="padding:12px 16px;border-radius:${isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px'};background:${isUser ? 'var(--surface-2)' : 'var(--surface)'};border:1px solid ${isUser ? 'var(--border-strong)' : 'var(--border)'};color:var(--text);font-size:13.5px;line-height:1.6;white-space:pre-wrap;box-shadow:var(--shadow-sm);max-width:${isUser ? '85%' : '100%'}">${esc(m.content)}</div>
              </div>`;
            })
            .join('')}
          ${
            thinking
              ? `<div style="display:flex;flex-direction:column;align-items:flex-start;max-width:760px;margin:0 auto;width:100%">
                  <div class="row" style="gap:6px;margin-bottom:4px;font-size:11px;color:var(--text-3)">
                    <span style="color:var(--accent);font-weight:500">Revelation Agent</span><span>·</span><span>Analyzing…</span>
                  </div>
                  <div class="row" style="gap:8px;padding:12px 16px;border-radius:12px 12px 12px 2px;background:var(--surface);border:1px solid var(--border);color:var(--text-3);font-size:13px">
                    <span class="btn is-loading" style="width:14px;height:14px;pointer-events:none"></span>
                    <span>Synthesizing response and structuring roadmap…</span>
                  </div>
                </div>`
              : ''
          }
        </div>

        <!-- Sticky Bottom Chat Bar -->
        <div style="padding:12px var(--gutter) 16px;border-top:1px solid var(--border);background:transparent;z-index:2">
          <div style="max-width:760px;margin:0 auto;position:relative;background:var(--surface);border:1px solid var(--border-strong);border-radius:12px;padding:10px 14px">
            <textarea
              id="agents-input"
              class="textarea"
              placeholder="Reply to Revelation Agent…"
              rows="1"
              data-in="agentsDraft"
              data-key-enter="submitAgentChat"
              style="width:100%;background:transparent;border:none;padding:0;outline:none;resize:none;font-size:13.5px;line-height:1.45;color:var(--text);padding-right:40px"
            >${esc(agentsState.inputDraft || '')}</textarea>
            
            <button
              class="ibtn ibtn-xs"
              data-a="submitAgentChat"
              style="position:absolute;right:8px;bottom:8px;width:24px;height:24px;border-radius:6px;background:${agentsState.inputDraft?.trim() ? 'var(--accent)' : 'var(--surface-3)'};color:${agentsState.inputDraft?.trim() ? 'var(--on-accent)' : 'var(--text-4)'};display:grid;place-items:center;transition:background var(--dur)"
              aria-label="Send"
            >
              ${ic('arrow-up', 13)}
            </button>
          </div>
        </div>`
    }
  </div>`;
}

/* Actions */
A.clearAgentChat = () => {
  agentsState.messages = [];
  render();
};

A.sendSuggestedPrompt = el => {
  const prompt = el.dataset.prompt;
  if (!prompt) return;
  agentsState.inputDraft = prompt;
  A.submitAgentChat();
};

IN.agentsDraft = el => {
  agentsState.inputDraft = el.value;
};

KEY.submitAgentChat = () => {
  A.submitAgentChat();
};

A.submitAgentChat = () => {
  const text = (agentsState.inputDraft || '').trim();
  if (!text || agentsState.isThinking) return;

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  agentsState.messages.push({
    role: 'user',
    content: text,
    time: timeStr,
  });

  agentsState.inputDraft = '';
  agentsState.isThinking = true;
  render();

  setTimeout(() => {
    const box = document.getElementById('agents-chat-body');
    if (box) box.scrollTop = box.scrollHeight;
  }, 10);

  setTimeout(() => {
    agentsState.isThinking = false;
    const now2 = new Date();
    const timeStr2 = `${String(now2.getHours()).padStart(2, '0')}:${String(now2.getMinutes()).padStart(2, '0')}`;

    let reply = generateAgentReply(text);
    agentsState.messages.push({
      role: 'agent',
      content: reply,
      time: timeStr2,
    });

    render();
    setTimeout(() => {
      const box = document.getElementById('agents-chat-body');
      if (box) box.scrollTop = box.scrollHeight;
      const inp = document.getElementById('agents-input');
      if (inp) inp.focus();
    }, 10);
  }, 600);
};

function generateAgentReply(query) {
  const q = query.toLowerCase();
  if (q.includes('project') || q.includes('roadmap') || q.includes('kyc')) {
    return `### Project Roadmap: Automated KYC & Verification Pipeline\n\n1. **Architecture & Compliance:**\n   - Partner with certified IDV gateway for document authenticity validation.\n   - Implement Sanctions / PEP watchlist screening with 24h caching.\n\n2. **Ledger & Settlement:**\n   - Automated level-2 verification badge assigned to member accounts.\n   - Webhook trigger to activate multi-currency wallet upon successful verification.\n\n3. **Milestones:**\n   - Week 1–2: Ingress validation & sandbox webhook testing.\n   - Week 3: Production canary deployment with 5% traffic split.`;
  }
  if (q.includes('research') || q.includes('interchange') || q.includes('stripe')) {
    return `### Market Research: Interchange Fee Compression\n\n- **Stripe vs Adyen Interchange:** Adyen's Interchange++ pricing delivers ~8–14bps optimization for enterprise transaction volumes exceeding $50M/year.\n- **Direct Card Network Routing:** Implementing network tokenization lowers decline rates by ~3.2% while reducing scheme fraud liability.\n- **Recommendation:** Implement automated smart routing across acquiring partners to optimize settlement fees.`;
  }
  return `### Strategic Analysis\n\nRe: "${query}"\n\nI have scoped this request against Revelation Fintech's current workspace posture. We can generate automatic tasks, project boards, and assign team owners directly from this specification whenever you are ready to execute.`;
}
