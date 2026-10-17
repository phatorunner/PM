/* ---------- PHASES VIEW & MANAGEMENT ---------- */
import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { S, tasksOf } from '../core/store.js';
import { kcard } from './board.js';
import { empty } from '../ui/helpers.js';

export function phasesHtml(p) {
  if (!p) return '';
  if (!p.phases) {
    p.phases = [{ id: 1, name: 'Phase 1', desc: '' }];
  }
  const key = 'phases:' + p.id;
  const allTasks = tasksOf(p.id);

  // Group tasks by phase ID
  const phaseMap = new Map();
  p.phases.forEach((ph, idx) => {
    phaseMap.set(ph.id, {
      ...ph,
      orderNum: idx + 1,
      tasks: [],
    });
  });

  const unassignedTasks = [];
  allTasks.forEach(t => {
    if (t.phase && phaseMap.has(t.phase)) {
      phaseMap.get(t.phase).tasks.push(t);
    } else {
      unassignedTasks.push(t);
    }
  });

  return `<div class="phases-view-wrap" style="display:flex;flex-direction:column;flex:1;min-height:0;height:100%">
    <!-- Main Phases Columns / Board -->
    <div class="board" data-keep="board:${key}" style="flex:1;min-height:0;padding-top:16px">
      ${p.phases.map((ph, idx) => {
        const orderNum = idx + 1;
        const col = (phaseMap.get(ph.id)?.tasks || []).sort((a, b) => a.order - b.order);
        const ck = key + ':' + ph.id;
        const isFirst = idx === 0;
        const isLast = idx === p.phases.length - 1;

        if (S.ui.collapsedCols[ck]) {
          return `<div class="bcol collapsed" data-a="toggleCol" data-ck="${ck}" data-drop-col="${ph.id}" data-drop-type="phase" data-key="${key}" role="button" aria-label="Expand Phase ${orderNum}: ${esc(ph.name)}" title="Expand">
            <span class="mono" style="font-size:11px;font-weight:700;color:var(--accent)">P${orderNum}</span>
            <span class="vname">${esc(ph.name)}<span class="faint">${col.length}</span></span>
          </div>`;
        }

        const comp = S.ui.composer && S.ui.composer.ctx === key && String(S.ui.composer.group) === String(ph.id);

        return `<section class="bcol" data-drop-col="${ph.id}" data-drop-type="phase" data-key="${key}" aria-label="Phase ${orderNum}: ${esc(ph.name)}" style="display:flex;flex-direction:column">
          <!-- Column Header -->
          <div class="bcol-h" style="padding-bottom:8px;border-bottom:1px solid var(--border-soft, var(--border));margin-bottom:6px">
            <span class="mono" style="font-size:11px;font-weight:700;color:var(--accent);padding:2px 6px;border-radius:var(--r-sm);background:color-mix(in srgb,var(--accent) 15%,var(--surface-3));letter-spacing:0.02em">P${orderNum}</span>
            <span style="font-weight:600;font-size:13.5px;cursor:pointer" data-a="openPhaseModal" data-project="${p.id}" data-phase="${ph.id}" data-tip="Click to edit phase" title="Edit phase">${esc(ph.name)}</span>
            <span class="cnt">${col.length}</span>
            <span class="acts" style="opacity:0.75">
              <button class="ibtn ibtn-xs" data-a="movePhaseOrder" data-project="${p.id}" data-phase="${ph.id}" data-dir="up" data-tip="Move left" aria-label="Move left" ${isFirst ? 'disabled style="opacity:0.3;cursor:not-allowed"' : ''}>${ic('chevron-left', 13)}</button>
              <button class="ibtn ibtn-xs" data-a="movePhaseOrder" data-project="${p.id}" data-phase="${ph.id}" data-dir="down" data-tip="Move right" aria-label="Move right" ${isLast ? 'disabled style="opacity:0.3;cursor:not-allowed"' : ''}>${ic('chevron-right', 13)}</button>
              <button class="ibtn ibtn-xs" data-a="openPhaseModal" data-project="${p.id}" data-phase="${ph.id}" data-tip="Edit phase details" aria-label="Edit">${ic('pencil', 12)}</button>
              <button class="ibtn ibtn-xs" data-a="removePhase" data-project="${p.id}" data-phase="${ph.id}" data-tip="Delete phase" aria-label="Delete" style="color:var(--red)">${ic('trash-2', 12)}</button>
            </span>
          </div>

          ${ph.desc ? `<div class="faint" style="font-size:11.5px;padding:2px 10px 8px;line-height:1.45;color:var(--text-3);border-bottom:1px dashed var(--border)">${esc(ph.desc)}</div>` : ''}

          <!-- Tasks Column Body -->
          <div class="bcol-b" data-col-body="${ph.id}" style="flex:1">
            ${col.map(t => kcard(t, { showProj: false, showStatus: true, hidePhase: true })).join('')}
            ${
              comp
                ? `<div class="composer"><textarea id="composer-in" data-key-enter="commitComposer" placeholder="Task name" rows="2" aria-label="New task name"></textarea><div class="row"><span class="faint" style="font-size:11px">Enter to add · Esc to cancel</span><span class="sp"></span><button class="btn btn-sm btn-ghost" data-a="cancelComposer">Cancel</button><button class="btn btn-sm btn-primary" data-a="commitComposer">Add</button></div></div>`
                : `<button class="addcard" data-a="startComposer" data-ctx="${key}" data-group="${ph.id}" data-gb='${JSON.stringify({ project: p.id, phase: ph.id })}'>${ic('plus', 14)}Add task</button>`
            }
          </div>
        </section>`;
      }).join('')}

      <!-- Unassigned Tasks column if any tasks have no phase assigned -->
      ${unassignedTasks.length ? `
        <section class="bcol" style="border-style:dashed;background:color-mix(in srgb,var(--surface) 60%,transparent)">
          <div class="bcol-h">
            <span class="mono faint" style="font-size:11px;padding:2px 6px;border-radius:var(--r-sm);background:var(--surface-3)">—</span>
            <span style="font-weight:500;color:var(--text-2)">Unassigned</span>
            <span class="cnt">${unassignedTasks.length}</span>
          </div>
          <div class="bcol-b">
            ${unassignedTasks.map(t => kcard(t, { showProj: false, showStatus: true, hidePhase: true })).join('')}
          </div>
        </section>
      ` : ''}
    </div>
  </div>`;
}
