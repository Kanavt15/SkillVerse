/** Original demo course content, installed only by the LOCAL development seed. Existing edits are preserved. */
const DEMO_TEACHER = '01890000-0000-7000-8000-000000000002';
const q = (value) => `'${String(value).replace(/'/g, "''")}'`;
const id = (number) => `01890000-0000-7000-8000-${number.toString(16).padStart(12, '0')}`;

const COURSES = [
  {
    slug: 'build-your-first-web-page',
    title: 'Build your first web page',
    subtitle: 'Turn a blank file into a personal page with HTML and CSS.',
    category: 'web-development',
    outcomes: [
      'Structure a page with semantic HTML',
      'Style a layout with readable CSS',
      'Build a responsive personal page',
    ],
    description:
      'Build a small personal website from scratch. You will write meaningful HTML, add a simple stylesheet, and make the page comfortable to read on a phone. Each lesson includes a small task you can complete in your browser. No framework or paid software is needed. This is an original development demo course for exploring SkillVerse.',
    lessons: [
      {
        title: 'Give your page a structure',
        minutes: 8,
        body: `# A page begins with meaning

HTML describes what the content is. A heading introduces a topic, a paragraph explains it, and a link lets someone move to another page. Start with the meaning before choosing colors.

Create a file named \`index.html\` and open it in a browser:

\`\`\`html
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>My first page</title></head>
  <body>
    <main>
      <h1>Hello, I’m learning to build for the web</h1>
      <p>This is a small place to share what I make.</p>
    </main>
  </body>
</html>
\`\`\`

## Try it

Replace the heading with your name and add a paragraph about a skill you want to learn. Use one main heading and meaningful section headings. Refresh the browser to see your changes.`,
      },
      {
        title: 'Make it readable with CSS',
        minutes: 10,
        body: `# Design for the person reading

CSS controls appearance. A useful first goal is a page that feels easy to read: comfortable spacing, strong contrast, and lines that do not stretch across the whole screen.

Add a \`style\` element inside the head:

\`\`\`css
body { font-family: system-ui, sans-serif; line-height: 1.6; }
main { max-width: 65ch; margin: 3rem auto; padding: 1rem; }
h1 { line-height: 1.2; }
a { color: #5840b8; }
\`\`\`

## Try it

Add two sections: a short biography and a list of projects. Use \`h2\` for the section titles. Change the spacing and explain which value makes the page easier to scan. Keep links underlined so they are easy to identify.`,
      },
      {
        title: 'Check it on a small screen',
        minutes: 10,
        body: `# A web page should adapt

Add a viewport declaration in the head so mobile browsers display the page at the device width:

\`\`\`html
<meta name="viewport" content="width=device-width, initial-scale=1">
\`\`\`

Avoid fixed widths for large content. Give images \`max-width: 100%\` so they fit their container. Test your page in a narrow browser window, then use the keyboard to visit every link.

## Your mini project

Finish the personal page with a heading, biography, two project links, and a contact link of your choice. Make sure the text stays readable at a width of 360 pixels. Check that every image has meaningful alternative text.

Write a note about one change you made after testing the page. You now have a small artifact you can improve as you learn more.`,
      },
    ],
  },
  {
    slug: 'python-for-everyday-problems',
    title: 'Python for everyday problems',
    subtitle: 'Practice variables, lists and loops with a tiny expense tracker.',
    category: 'data-science',
    outcomes: [
      'Store and combine simple values',
      'Use lists and loops to process data',
      'Build a small expense summary',
    ],
    description:
      'Learn the first building blocks of Python through a practical project. Start with values, move to collections, and finish with a small expense summary. Copy the examples into a local Python installation or a browser notebook. This original demo course focuses on understanding each line and checking your results, rather than memorizing syntax.',
    lessons: [
      {
        title: 'Name a value and use it',
        minutes: 7,
        body: `# Values and variables

A variable gives a name to a value. Use names that explain what the value represents. Python can work with numbers and text, and the type of a value affects what operations make sense.

\`\`\`python
tea_price = 20
number_of_cups = 3
total = tea_price * number_of_cups
print(total)
\`\`\`

This prints 60. Change the number of cups and predict the result before running it.

## Try it

Create variables for the cost of a notebook and a pen. Calculate the total for two notebooks and three pens. Print a short message that includes the total. Keep your calculations as numbers until you format the result for display.`,
      },
      {
        title: 'Process a list with a loop',
        minutes: 9,
        body: `# A collection of expenses

A list keeps values in order. A loop lets you do the same operation for each value in the list without repeating code.

\`\`\`python
expenses = [20, 35, 50, 15]
total = 0
for expense in expenses:
    total = total + expense
print(total)
\`\`\`

Indentation tells Python which statements belong to the loop. The print statement runs after all expenses have been processed.

## Try it

Add two more expenses. Predict the new total. Then count how many expenses are greater than 30 using an \`if\` statement inside the loop. Explain the difference between the total amount and the number of entries.`,
      },
      {
        title: 'Build an expense summary',
        minutes: 12,
        body: `# A small useful program

Combine the ideas from the first two lessons into a summary. A function gives a name to a reusable operation.

\`\`\`python
def summarize(expenses):
    if not expenses:
        return {"total": 0, "count": 0, "average": 0}
    total = sum(expenses)
    return {"total": total, "count": len(expenses),
            "average": total / len(expenses)}

print(summarize([20, 35, 50, 15]))
\`\`\`

## Your mini project

Run the function with an empty list, one expense, and five expenses. Check the result by hand. Add a highest-expense field while handling the empty list safely.

Write a private note explaining why the empty-list check happens before division. Good programs account for the cases where there is no data yet.`,
      },
    ],
  },
  {
    slug: 'design-a-clearer-mobile-screen',
    title: 'Design a clearer mobile screen',
    subtitle: 'Use hierarchy, spacing and feedback to improve a simple app flow.',
    category: 'design',
    outcomes: [
      'Identify the primary action on a screen',
      'Create a readable type and spacing hierarchy',
      'Review a flow for clarity and accessibility',
    ],
    description:
      'Practice interface design by improving a small mobile screen. Begin with the user’s task, organize the content around that task, and add useful feedback. You can work on paper or in your preferred design tool. This original development demo introduces practical habits you can apply to a learning app, a booking flow, or your own portfolio.',
    lessons: [
      {
        title: 'Start with a person and a task',
        minutes: 6,
        body: `# What is the person trying to do?

Before drawing a screen, describe the person using it and the action they need to finish. For example: a learner has ten minutes and wants to continue the next unfinished lesson.

List the information needed for that decision: the course title, the next lesson, and the progress so far. Make the primary action easy to find. Secondary actions, such as reading the full course description, can have less visual emphasis.

## Try it

Sketch a mobile learning dashboard on paper. Choose one primary action and write its button text. Remove any element that does not help the learner decide what to do next. Ask someone to point to the action without giving them instructions.`,
      },
      {
        title: 'Build a visible hierarchy',
        minutes: 8,
        body: `# Make the important things easy to scan

Hierarchy comes from size, weight, spacing and placement. Use these tools to explain the relationship between pieces of content. A course title should stand apart from supporting metadata without making every word compete for attention.

## Try it

Create three text styles: a screen heading, a course title, and supporting text. Use a consistent spacing scale, such as 4, 8, 16 and 24. Group related elements with smaller gaps and separate different sections with larger gaps.

Review your screen at its actual phone size. Avoid relying on color alone to show progress or errors. Add labels and clear text so the meaning remains understandable without color.`,
      },
      {
        title: 'Design the next state',
        minutes: 10,
        body: `# A screen is part of a conversation

An interface responds when someone acts. Consider what happens while an action is loading, after it succeeds, and when something fails.

For a learning dashboard, sketch an empty state that points to finding a course. For a completed course, show a way to get the completion certificate. For a save error, explain that the note was not saved and keep the learner’s text so they can retry.

## Your mini project

Create three versions of your dashboard: no enrollments, a course in progress, and a completed course. Check that each state has a clear next step. Ask someone to navigate between them using only the button labels.

Record one piece of feedback and the change you made in response. Design improves when a real person tries the flow.`,
      },
    ],
  },
];

/** SQL statements joined to the dev-account seed. Stable IDs and INSERT OR IGNORE preserve instructor edits. */
export function demoCourseStatements(now) {
  const statements = [];
  COURSES.forEach((course, index) => {
    const courseId = id(0xd000 + index);
    const sectionId = id(0xe000 + index);
    const duration = course.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0);
    statements.push(
      `INSERT OR IGNORE INTO courses (id, instructor_id, slug, title, subtitle, description, category_id, level, learning_outcomes, requirements, status, lesson_count, duration_minutes, published_at, created_at, updated_at) SELECT ${q(courseId)}, ${q(DEMO_TEACHER)}, ${q(course.slug)}, ${q(course.title)}, ${q(course.subtitle)}, ${q(course.description)}, id, 'beginner', ${q(JSON.stringify(course.outcomes))}, '[]', 'published', 3, ${duration}, ${now}, ${now}, ${now} FROM categories WHERE slug = ${q(course.category)};`,
    );
    statements.push(
      `INSERT OR IGNORE INTO sections (id, course_id, title, position, created_at, updated_at) VALUES (${q(sectionId)}, ${q(courseId)}, 'From first idea to a small project', 0, ${now}, ${now});`,
    );
    course.lessons.forEach((lesson, position) =>
      statements.push(
        `INSERT OR IGNORE INTO lessons (id, course_id, section_id, title, type, position, is_preview, duration_minutes, content_markdown, created_at, updated_at) VALUES (${q(id(0xf000 + index * 10 + position))}, ${q(courseId)}, ${q(sectionId)}, ${q(lesson.title)}, 'article', ${position}, ${position === 0 ? 1 : 0}, ${lesson.minutes}, ${q(lesson.body)}, ${now}, ${now});`,
      ),
    );
  });
  return statements;
}
