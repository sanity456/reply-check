'use client';
import { useState } from 'react';
import { saveBrowserValue, useBrowserValue } from '@/hooks/use-browser-value';
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { challenges, gymProgress } from '@/lib/reply/gym';
import { Notice } from './common';

export function ReplyGym() {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [session, setComplete] = useState<string[]>([]);
  const saved = useBrowserValue('replycheck:gym:v1');
  const complete = saved ? gymProgress(saved) : session;
  const [storageError, setStorageError] = useState(false);
  const current = challenges[index];
  const pick = (answer: number) => {
    if (choice !== null) return;
    setChoice(answer);
    if (answer === current.answer) {
      const next = [...new Set([...complete, current.id])];
      setComplete(next);
      try {
        saveBrowserValue('replycheck:gym:v1', JSON.stringify(next));
      } catch {
        setStorageError(true);
      }
    }
  };
  return (
    <div className="review-grid gym-grid">
      <section className="panel gym-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">
              EXERCISE {index + 1} OF {challenges.length}
            </span>
            <h2>{current.topic}</h2>
          </div>
          <span className="pill">Curated practice</span>
        </div>
        <p className="question-line">{current.question}</p>
        <div className="gym-reference">
          <span className="small-label">FICTIONAL REFERENCE</span>
          <blockquote>{current.reference}</blockquote>
        </div>
        <span className="small-label">THE DRAFT</span>
        <p className="gym-reply">“{current.reply}”</p>
        <fieldset className="gym-options">
          <legend>Your call?</legend>
          {current.options.map((option, i) => (
            <Button
              key={option}
              variant="outline"
              className={
                choice !== null && i === current.answer
                  ? 'correct-option'
                  : choice === i
                    ? 'wrong-option'
                    : ''
              }
              disabled={choice !== null}
              onClick={() => pick(i)}
            >
              {choice !== null && i === current.answer ? (
                <Check size={17} />
              ) : (
                <span className="option-letter">
                  {String.fromCharCode(65 + i)}
                </span>
              )}
              {option}
            </Button>
          ))}
        </fieldset>
        {choice !== null && (
          <div className="gym-feedback" aria-live="polite">
            <h3>
              {choice === current.answer
                ? 'That’s the right call.'
                : 'Not quite. Here’s why.'}
            </h3>
            <p>{current.reason}</p>
            <blockquote>{current.rewrite}</blockquote>
            <div className="button-row">
              <Button
                onClick={() => {
                  setIndex((index + 1) % challenges.length);
                  setChoice(null);
                }}
              >
                Next exercise <ArrowRight />
              </Button>
              <Button variant="ghost" onClick={() => setChoice(null)}>
                <RotateCcw /> Try again
              </Button>
            </div>
          </div>
        )}
      </section>
      <aside className="reference-column">
        <section className="gym-teaser">
          <Sparkles size={28} />
          <h2>Your progress</h2>
          <div className="gym-score">
            {complete.length}
            <span> / {challenges.length}</span>
          </div>
          <p>Exercises answered correctly</p>
          <progress
            className="progress-track"
            aria-label="Practice progress"
            max={challenges.length}
            value={complete.length}
          />
        </section>
        <section className="panel">
          <h2>About this practice</h2>
          <p className="muted">
            Fictional exercises, not live AI reviews or on-chain records. No
            wallet needed.
          </p>
          <div className="button-row">
            <Button
              variant="ghost"
              onClick={() => {
                setComplete([]);
                setChoice(null);
                setIndex(0);
                try {
                  saveBrowserValue('replycheck:gym:v1', null);
                } catch {
                  setStorageError(true);
                }
              }}
            >
              Reset my practice
            </Button>
          </div>
          <p className="muted">Progress stays on this device.</p>
        </section>
        {storageError && (
          <Notice>
            Your browser cannot save practice progress. You can still play.
          </Notice>
        )}
      </aside>
    </div>
  );
}
