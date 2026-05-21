import { useState } from 'react';
import './DemoControls.css';

type DemoMode = 'loaded' | 'loading' | 'error';

interface Props {
  mode:   DemoMode;
  onSet:  (mode: DemoMode) => void;
}

const MODES: { value: DemoMode; label: string; icon: string }[] = [
  { value: 'loading', label: 'Loading',  icon: 'bi-arrow-repeat'  },
  { value: 'loaded',  label: 'Loaded',   icon: 'bi-check-circle'  },
  { value: 'error',   label: 'Error',    icon: 'bi-x-circle'      },
];

export function DemoControls({ mode, onSet }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <div className={`demo-controls${open ? ' open' : ''}`}>
      <button className="demo-controls__toggle" onClick={() => setOpen(o => !o)} title="Toggle demo panel">
        <i className="bi bi-sliders" />
      </button>
      {open && (
        <div className="demo-controls__body">
          <span className="demo-controls__label">Demo State</span>
          <div className="demo-controls__btns">
            {MODES.map(({ value, label, icon }) => (
              <button
                key={value}
                className={`demo-btn demo-btn--${value}${mode === value ? ' active' : ''}`}
                onClick={() => onSet(value)}
              >
                <i className={`bi ${icon}`} />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
