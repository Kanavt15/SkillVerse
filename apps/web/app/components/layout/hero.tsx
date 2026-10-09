import {
  ArrowDown,
  BookOpen,
  Check,
  CircleHelp,
  MessagesSquare,
  Play,
  Search,
  Waypoints,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Form, Link } from 'react-router';
import { scroll } from 'motion';
import { Button } from '~/components/ui/button';

/** A conceptual learning diagram, not fabricated course data or learner activity. */
export function LearningDiagram() {
  return (
    <div
      className="skill-diagram"
      role="img"
      aria-label="Connected learning: video lessons, reading, practice quizzes and community questions"
    >
      <svg viewBox="0 0 500 500" fill="none" aria-hidden="true">
        <circle
          cx="250"
          cy="250"
          r="180"
          stroke="currentColor"
          strokeDasharray="3 8"
          opacity=".7"
        />
        <circle cx="250" cy="250" r="130" stroke="currentColor" opacity=".35" />
        <path d="M250 70V160M340 250H430M250 340V430M70 250H160" stroke="currentColor" />
        <circle cx="250" cy="127" r="4" fill="currentColor" />
        <circle cx="373" cy="250" r="4" fill="currentColor" />
        <circle cx="250" cy="373" r="4" fill="currentColor" />
        <circle cx="127" cy="250" r="4" fill="currentColor" />
      </svg>
      <div className="diagram-center" aria-hidden="true">
        <Waypoints strokeWidth={1.25} />
        <p>SkillVerse</p>
      </div>
      <div className="diagram-node diagram-node--video" aria-hidden="true">
        <span>
          <Play />
        </span>
        Video lessons
      </div>
      <div className="diagram-node diagram-node--reading" aria-hidden="true">
        <span>
          <BookOpen />
        </span>
        Reading
      </div>
      <div className="diagram-node diagram-node--quiz" aria-hidden="true">
        <span>
          <CircleHelp />
        </span>
        Practice quizzes
      </div>
      <div className="diagram-node diagram-node--community" aria-hidden="true">
        <span>
          <MessagesSquare />
        </span>
        Community Q&amp;A
      </div>
    </div>
  );
}

export function Hero() {
  const target = useRef<HTMLElement>(null);
  const diagram = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const section = target.current,
      artwork = diagram.current,
      line = progress.current;
    if (!section || !artwork || !line) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const setup = () => {
      if (preference.matches) return () => {};
      const stop = scroll(
        (value) => {
          artwork.style.transform = `translateY(${-45 * value}px) rotate(${-5 * value}deg)`;
          line.style.transform = `scaleX(${value})`;
        },
        { target: section, offset: ['start start', 'end start'] },
      );
      return () => {
        stop();
        artwork.style.removeProperty('transform');
        line.style.removeProperty('transform');
      };
    };
    let cleanup = setup();
    const update = () => {
      cleanup();
      cleanup = setup();
    };
    preference.addEventListener('change', update);
    return () => {
      preference.removeEventListener('change', update);
      cleanup();
    };
  }, []);
  return (
    <section ref={target} className="hero-section" aria-labelledby="hero-title">
      <div className="hero-inner">
        <div className="hero-grid">
          <div>
            <h1 id="hero-title" className="hero-title">
              Make room for your next skill.
            </h1>
            <p className="hero-copy">
              Learn from people who know their craft. Try a lesson, put it into practice, and share
              what you discover.
            </p>
            <Form method="get" action="/courses" role="search" className="hero-search">
              <Search aria-hidden="true" />
              <label htmlFor="hero-search" className="sr-only">
                Search courses
              </label>
              <input
                id="hero-search"
                type="search"
                name="q"
                placeholder="Search a skill"
                maxLength={100}
              />
              <Button type="submit">
                Explore<span className="sr-only"> courses</span>
              </Button>
            </Form>
            <div className="hero-secondary">
              <Link to="/teach">Teach on SkillVerse</Link>
              <span>
                <Check className="size-4" aria-hidden="true" />
                Free courses to get started
              </span>
            </div>
          </div>
          <div ref={diagram} className="hero-motion">
            <LearningDiagram />
          </div>
        </div>
        <div className="hero-bottom">
          <a href="#discover" className="scroll-cue">
            Find your starting point
            <ArrowDown aria-hidden="true" />
          </a>
          <p>Learn at your pace. Keep building.</p>
        </div>
      </div>
      <div ref={progress} aria-hidden="true" className="hero-progress" />
    </section>
  );
}
