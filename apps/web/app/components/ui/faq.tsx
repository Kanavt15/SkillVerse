import * as Accordion from '@radix-ui/react-accordion';
import { Plus } from 'lucide-react';
import { useHydrated } from '~/lib/use-hydrated';

const QUESTIONS = [
  {
    question: 'Can I try a course before signing up?',
    answer:
      'Yes. Lessons marked Preview are open to everyone. Create an account and confirm your email when you want to enroll and save your progress.',
  },
  {
    question: 'What happens when I finish a course?',
    answer:
      'Complete every lesson and pass any required practice quizzes to request a certificate of completion. Your certificate has a shareable verification link.',
  },
  {
    question: 'Can I share a skill by teaching?',
    answer:
      'Apply on the teaching page with your topics and a sample. Approved instructors can create lessons and quizzes in the Studio, then submit their course for review.',
  },
  {
    question: 'Are paid courses, mentoring and skill swaps available?',
    answer:
      'Free course enrollment is available now. Paid enrollment, mentoring and skill swaps are planned; they are not open for booking or purchase yet.',
  },
];

/** Native disclosures remain available before hydration and when JavaScript is disabled. */
export function FAQ() {
  const hydrated = useHydrated();
  if (!hydrated)
    return (
      <div>
        {QUESTIONS.map(({ question, answer }) => (
          <details className="faq-item" key={question}>
            <summary className="faq-trigger">
              {question}
              <Plus aria-hidden="true" />
            </summary>
            <p className="faq-answer">{answer}</p>
          </details>
        ))}
      </div>
    );
  return (
    <Accordion.Root type="multiple">
      {QUESTIONS.map(({ question, answer }) => (
        <Accordion.Item className="faq-item" key={question} value={question}>
          <Accordion.Header>
            <Accordion.Trigger className="faq-trigger">
              {question}
              <Plus aria-hidden="true" />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>
            <p className="faq-answer">{answer}</p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
