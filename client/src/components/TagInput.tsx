import { useLayoutEffect, useRef, useState } from 'react';
import { useDismissable } from '../hooks/useDismissable';

interface TagInputProps {
  value: string[];
  /** Existing tags offered in the list; anything typed is also accepted. */
  options: string[];
  onChange: (value: string[]) => void;
  max?: number;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Multi-select combobox: chosen tags render as removable pills in front of a
 * type-ahead field, and the list below works like `MultiSelectDropdown` —
 * every known tag with a check, click to toggle on or off. Anything typed
 * that isn't in the list is added on Enter/comma/blur. Once `max` tags are
 * chosen the unselected options and the text field are disabled; deselect
 * one (in the list or on its pill) to free a slot.
 */
export function TagInput({ value, options, onChange, max = 3, maxLength = 16, placeholder = 'Add a tag', disabled }: TagInputProps) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useDismissable(ref, open, () => setOpen(false));

  const full = value.length >= max;
  const query = draft.trim().toLowerCase();
  // Selected tags always stay listed (so they can be unticked); others narrow by the draft.
  const listed = [...new Set([...options, ...value])]
    .filter((o) => value.includes(o) || !query || o.toLowerCase().includes(query))
    .sort((a, b) => a.localeCompare(b));

  // The field often sits at the bottom of a scrollable sidebar that would clip
  // a list opening downward — so measure once on open and flip it upward when
  // it wouldn't fit inside the nearest scrolling ancestor (or the viewport).
  const [openUp, setOpenUp] = useState(false);
  useLayoutEffect(() => {
    if (!open || !listRef.current) return;
    const list = listRef.current;
    let clip: HTMLElement | null = list.parentElement;
    while (clip && !/(auto|scroll)/.test(getComputedStyle(clip).overflowY)) clip = clip.parentElement;
    const limit = clip ? clip.getBoundingClientRect().bottom : window.innerHeight;
    // Measure from the field, not the list — the list moves once flipped.
    const fieldBottom = ref.current!.getBoundingClientRect().bottom;
    setOpenUp(fieldBottom + 4 + list.offsetHeight > limit);
  }, [open, listed.length]);

  function add(raw: string) {
    const tag = raw.trim().slice(0, maxLength);
    if (!tag || full) return;
    if (!value.some((t) => t.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
    setDraft('');
  }

  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function toggle(tag: string) {
    if (value.includes(tag)) remove(tag);
    else add(tag);
  }

  function openList() {
    if (disabled) return;
    setOpen(true);
    inputRef.current?.focus();
  }

  return (
    <div className={`tag-input${disabled ? ' disabled' : ''}`} ref={ref} onClick={openList}>
      {value.map((tag) => (
        <span className="filter-chip" key={tag}>
          {tag}
          <button type="button" aria-label={`Remove tag ${tag}`} disabled={disabled} onClick={() => remove(tag)}>×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={draft}
        placeholder={value.length ? '' : placeholder}
        maxLength={maxLength}
        disabled={disabled}
        readOnly={full}
        aria-label="Add a tag"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setDraft(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && !draft && value.length) {
            remove(value[value.length - 1]);
          }
        }}
        onBlur={() => add(draft)}
      />
      {open && listed.length > 0 && (
        <ul className={`dropdown-list combobox-list${openUp ? ' open-up' : ''}`} role="listbox" aria-multiselectable="true" ref={listRef}>
          {listed.map((opt) => {
            const checked = value.includes(opt);
            return (
              <li key={opt}>
                <button
                  type="button"
                  role="option"
                  aria-selected={checked}
                  disabled={!checked && full}
                  // mousedown, not click: the input's blur would otherwise add the
                  // draft first and close the list before the click lands.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    toggle(opt);
                  }}
                >
                  <span className={`dropdown-check${checked ? ' checked' : ''}`} aria-hidden="true" />
                  {opt}
                </button>
              </li>
            );
          })}
          {full && <li className="dropdown-note">Limit of {max} reached — untick one to add another</li>}
        </ul>
      )}
    </div>
  );
}
