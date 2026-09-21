/**
 * Practice Arena problem bank.
 *
 * Split out of the main seed because it is the part most likely to grow.
 *
 * Every problem carries at least one VISIBLE case (shown as a worked sample)
 * and one or more HIDDEN cases (the grading suite). Hidden cases are what stop
 * a learner hard-coding the sample answer, so every problem needs them.
 *
 * Input format is kept deliberately uniform — whitespace-separated tokens on
 * stdin — so a learner switching problems does not have to relearn parsing.
 */

module.exports = [
    // ── EASY ──────────────────────────────────────────────────────
    {
        title: 'Two Sum',
        slug: 'two-sum',
        difficulty: 'easy',
        category: 'Data Structures',
        tags: ['arrays', 'hashing'],
        description:
            'Given an array of integers and a target value, return the indices of the two '
            + 'numbers that add up to the target.\n\n'
            + 'Exactly one valid answer exists, and you may not use the same element twice.',
        inputFormat: 'Line 1: n and target.\nLine 2: n integers.',
        outputFormat: 'Two space-separated indices (0-based), smaller index first.',
        constraints: '2 <= n <= 10^4, -10^9 <= nums[i] <= 10^9',
        examples: [{ input: '4 9\n2 7 11 15', output: '0 1', explanation: 'nums[0] + nums[1] = 2 + 7 = 9' }],
        testCases: [
            { input: '4 9\n2 7 11 15', expectedOutput: '0 1', isHidden: false, order: 1 },
            { input: '3 6\n3 2 4', expectedOutput: '1 2', isHidden: true, order: 2 },
            { input: '2 6\n3 3', expectedOutput: '0 1', isHidden: true, order: 3 },
            { input: '5 -8\n-3 4 -5 7 1', expectedOutput: '0 2', isHidden: true, order: 4 },
        ],
        editorial:
            'The brute-force pair scan is O(n^2). The trick is to remember what you have '
            + 'already seen.\n\nWalk the array once, keeping a hash map from value to index. '
            + 'At each element v, the number you need is target - v. If it is already in the '
            + 'map you have your pair; otherwise record v and continue.\n\n'
            + 'One pass, O(n) time and O(n) space.',
    },
    {
        title: 'Reverse a String',
        slug: 'reverse-a-string',
        difficulty: 'easy',
        category: 'Programming',
        tags: ['strings', 'two-pointers'],
        description: 'Read a single line and print it reversed.',
        inputFormat: 'A single line of text.',
        outputFormat: 'The reversed line.',
        constraints: '1 <= length <= 10^5',
        examples: [{ input: 'hello', output: 'olleh', explanation: '' }],
        testCases: [
            { input: 'hello', expectedOutput: 'olleh', isHidden: false, order: 1 },
            { input: 'SkillVerse', expectedOutput: 'esreVllikS', isHidden: true, order: 2 },
            { input: 'a', expectedOutput: 'a', isHidden: true, order: 3 },
        ],
        editorial:
            'Most languages reverse a string in one call. Doing it by hand: put one pointer '
            + 'at each end, swap, and walk them toward the middle until they meet. '
            + 'O(n) time, O(1) extra space if the buffer is mutable.',
    },
    {
        title: 'FizzBuzz',
        slug: 'fizzbuzz',
        difficulty: 'easy',
        category: 'Programming',
        tags: ['mathematics'],
        description:
            'Print the numbers from 1 to n, one per line, replacing multiples of 3 with '
            + '"Fizz", multiples of 5 with "Buzz", and multiples of both with "FizzBuzz".',
        inputFormat: 'A single integer n.',
        outputFormat: 'n lines.',
        constraints: '1 <= n <= 10^4',
        examples: [{ input: '5', output: '1\n2\nFizz\n4\nBuzz', explanation: '' }],
        testCases: [
            { input: '5', expectedOutput: '1\n2\nFizz\n4\nBuzz', isHidden: false, order: 1 },
            { input: '15', expectedOutput: '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz', isHidden: true, order: 2 },
            { input: '1', expectedOutput: '1', isHidden: true, order: 3 },
        ],
        editorial:
            'Check divisibility by 15 first — or build the string by appending "Fizz" when '
            + 'divisible by 3 and "Buzz" when divisible by 5, printing the number only if the '
            + 'string is still empty. The second version avoids the nested-condition tangle.',
    },
    {
        title: 'Maximum Subarray Sum',
        slug: 'maximum-subarray-sum',
        difficulty: 'easy',
        category: 'Algorithms',
        tags: ['arrays', 'dynamic-programming'],
        description:
            'Given an array of integers, find the largest sum obtainable from any contiguous '
            + 'non-empty subarray.',
        inputFormat: 'Line 1: n.\nLine 2: n integers.',
        outputFormat: 'A single integer.',
        constraints: '1 <= n <= 10^5',
        examples: [{ input: '9\n-2 1 -3 4 -1 2 1 -5 4', output: '6', explanation: 'The subarray [4, -1, 2, 1] sums to 6.' }],
        testCases: [
            { input: '9\n-2 1 -3 4 -1 2 1 -5 4', expectedOutput: '6', isHidden: false, order: 1 },
            { input: '1\n-3', expectedOutput: '-3', isHidden: true, order: 2 },
            { input: '5\n-2 -3 -1 -4 -6', expectedOutput: '-1', isHidden: true, order: 3 },
            { input: '4\n1 2 3 4', expectedOutput: '10', isHidden: true, order: 4 },
        ],
        editorial:
            "Kadane's algorithm. Track the best sum ending at the current index: either extend "
            + 'the previous run, or start fresh here — whichever is larger. Keep a running '
            + 'maximum of those values.\n\nThe all-negative case is why you must start from the '
            + 'first element rather than from 0.',
    },

    // ── MEDIUM ────────────────────────────────────────────────────
    {
        title: 'Reverse a Linked List',
        slug: 'reverse-linked-list',
        difficulty: 'medium',
        category: 'Data Structures',
        tags: ['linked-lists'],
        description:
            'You are given the values of a singly linked list in order. Print the values of '
            + 'the reversed list.',
        inputFormat: 'Line 1: n.\nLine 2: n integers.',
        outputFormat: 'The reversed values, space separated.',
        constraints: '0 <= n <= 5000',
        examples: [{ input: '5\n1 2 3 4 5', output: '5 4 3 2 1', explanation: '' }],
        testCases: [
            { input: '5\n1 2 3 4 5', expectedOutput: '5 4 3 2 1', isHidden: false, order: 1 },
            { input: '1\n7', expectedOutput: '7', isHidden: true, order: 2 },
            { input: '2\n1 2', expectedOutput: '2 1', isHidden: true, order: 3 },
        ],
        editorial:
            'The iterative version keeps three pointers — previous, current, next — and '
            + 'relinks one node per step. The subtlety is saving next BEFORE overwriting '
            + 'current.next, or you lose the rest of the list.',
    },
    {
        title: 'Valid Parentheses',
        slug: 'valid-parentheses',
        difficulty: 'medium',
        category: 'Data Structures',
        tags: ['strings'],
        description:
            'Given a string containing only the characters ()[]{}, determine whether the '
            + 'brackets are balanced and correctly nested. Print "true" or "false".',
        inputFormat: 'A single line of brackets.',
        outputFormat: 'true or false.',
        constraints: '1 <= length <= 10^4',
        examples: [
            { input: '()[]{}', output: 'true', explanation: '' },
            { input: '([)]', output: 'false', explanation: 'Closed in the wrong order.' },
        ],
        testCases: [
            { input: '()[]{}', expectedOutput: 'true', isHidden: false, order: 1 },
            { input: '([)]', expectedOutput: 'false', isHidden: true, order: 2 },
            { input: '{[()]}', expectedOutput: 'true', isHidden: true, order: 3 },
            { input: '(', expectedOutput: 'false', isHidden: true, order: 4 },
        ],
        editorial:
            'Push every opening bracket onto a stack. On a closing bracket, the top of the '
            + 'stack must be its match — otherwise fail immediately. The string is valid only '
            + 'if the stack is empty at the end, which is the check that catches a trailing '
            + 'unclosed bracket.',
    },
    {
        title: 'Binary Search',
        slug: 'binary-search',
        difficulty: 'medium',
        category: 'Algorithms',
        tags: ['searching', 'arrays'],
        description:
            'Given a sorted array and a target, print the index of the target, or -1 if it '
            + 'is absent.',
        inputFormat: 'Line 1: n and target.\nLine 2: n sorted integers.',
        outputFormat: 'The index, or -1.',
        constraints: '1 <= n <= 10^5',
        examples: [{ input: '6 9\n1 3 5 7 9 11', output: '4', explanation: '' }],
        testCases: [
            { input: '6 9\n1 3 5 7 9 11', expectedOutput: '4', isHidden: false, order: 1 },
            { input: '5 2\n1 3 5 7 9', expectedOutput: '-1', isHidden: true, order: 2 },
            { input: '1 1\n1', expectedOutput: '0', isHidden: true, order: 3 },
        ],
        editorial:
            'Halve the search space each step: compare against the midpoint and discard the '
            + 'side that cannot contain the target. O(log n).\n\n'
            + 'Compute the midpoint as lo + (hi - lo) / 2 rather than (lo + hi) / 2 — in '
            + 'fixed-width integer languages the latter overflows on large arrays.',
    },
    {
        title: 'Count Word Frequencies',
        slug: 'count-word-frequencies',
        difficulty: 'medium',
        category: 'Programming',
        tags: ['hashing', 'strings', 'sorting'],
        description:
            'Read a line of lowercase words separated by spaces. Print each distinct word and '
            + 'its count, one per line, ordered by count descending and then alphabetically.',
        inputFormat: 'A single line of words.',
        outputFormat: 'Lines of "word count".',
        constraints: '1 <= words <= 10^4',
        examples: [{ input: 'the cat the dog the', output: 'the 3\ncat 1\ndog 1', explanation: '' }],
        testCases: [
            { input: 'the cat the dog the', expectedOutput: 'the 3\ncat 1\ndog 1', isHidden: false, order: 1 },
            { input: 'a b c', expectedOutput: 'a 1\nb 1\nc 1', isHidden: true, order: 2 },
            { input: 'z z y y x', expectedOutput: 'y 2\nz 2\nx 1', isHidden: true, order: 3 },
        ],
        editorial:
            'Count into a hash map, then sort the entries. The tie-break matters: sort by '
            + 'count descending, then by word ascending. The third test exists precisely to '
            + 'catch solutions that forget the alphabetical tie-break.',
    },

    // ── HARD ──────────────────────────────────────────────────────
    {
        title: 'Longest Common Subsequence',
        slug: 'longest-common-subsequence',
        difficulty: 'hard',
        category: 'Algorithms',
        tags: ['dynamic-programming', 'strings'],
        description:
            'Given two strings, print the length of their longest common subsequence. '
            + 'A subsequence keeps relative order but need not be contiguous.',
        inputFormat: 'Two lines, one string each.',
        outputFormat: 'A single integer.',
        constraints: '1 <= length <= 1000',
        examples: [{ input: 'abcde\nace', output: '3', explanation: '"ace" is a subsequence of both.' }],
        testCases: [
            { input: 'abcde\nace', expectedOutput: '3', isHidden: false, order: 1 },
            { input: 'abc\ndef', expectedOutput: '0', isHidden: true, order: 2 },
            { input: 'aggtab\ngxtxayb', expectedOutput: '4', isHidden: true, order: 3 },
        ],
        editorial:
            'Classic 2-D dynamic programming. dp[i][j] is the LCS length of the first i '
            + 'characters of A and first j of B.\n\n'
            + 'If A[i-1] == B[j-1] then dp[i][j] = dp[i-1][j-1] + 1; otherwise it is the '
            + 'larger of dp[i-1][j] and dp[i][j-1].\n\n'
            + 'O(n*m) time. Only the previous row is ever read, so space collapses to O(min(n,m)).',
    },
    {
        title: 'Merge K Sorted Arrays',
        slug: 'merge-k-sorted-arrays',
        difficulty: 'hard',
        category: 'Data Structures',
        tags: ['sorting', 'arrays'],
        description:
            'Given k sorted arrays, merge them into one sorted sequence and print it.',
        inputFormat: 'Line 1: k.\nThen k lines, each starting with its length followed by that many sorted integers.',
        outputFormat: 'All values in sorted order, space separated.',
        constraints: '1 <= k <= 100, total elements <= 10^5',
        examples: [{ input: '3\n3 1 4 7\n2 2 5\n3 3 6 9', output: '1 2 3 4 5 6 7 9', explanation: '' }],
        testCases: [
            { input: '3\n3 1 4 7\n2 2 5\n3 3 6 9', expectedOutput: '1 2 3 4 5 6 7 9', isHidden: false, order: 1 },
            { input: '1\n1 42', expectedOutput: '42', isHidden: true, order: 2 },
            { input: '2\n2 1 1\n2 1 1', expectedOutput: '1 1 1 1', isHidden: true, order: 3 },
        ],
        editorial:
            'Concatenating and sorting is O(N log N) and passes here. The better answer keeps '
            + 'a min-heap of one candidate per array: pop the smallest, push that array\'s next '
            + 'element. That is O(N log k), which matters when k is small relative to N.',
    },
    {
        title: 'Detect Cycle in a Graph',
        slug: 'detect-cycle-in-a-graph',
        difficulty: 'hard',
        category: 'Algorithms',
        tags: ['graphs', 'recursion'],
        description:
            'Given a directed graph, determine whether it contains a cycle. Print "true" or "false".',
        inputFormat: 'Line 1: n (nodes, 0-indexed) and m (edges).\nNext m lines: u v, an edge from u to v.',
        outputFormat: 'true or false.',
        constraints: '1 <= n <= 10^4, 0 <= m <= 10^5',
        examples: [{ input: '3 3\n0 1\n1 2\n2 0', output: 'true', explanation: 'The three edges form a cycle.' }],
        testCases: [
            { input: '3 3\n0 1\n1 2\n2 0', expectedOutput: 'true', isHidden: false, order: 1 },
            { input: '3 2\n0 1\n1 2', expectedOutput: 'false', isHidden: true, order: 2 },
            { input: '1 0', expectedOutput: 'false', isHidden: true, order: 3 },
            { input: '4 4\n0 1\n1 2\n2 3\n3 1', expectedOutput: 'true', isHidden: true, order: 4 },
        ],
        editorial:
            'Depth-first search with three colours. White is unvisited, grey is on the current '
            + 'recursion stack, black is fully explored.\n\n'
            + 'An edge into a GREY node is a back edge, and that is a cycle. An edge into a '
            + 'black node is fine — it just means you reached an already-finished subtree.\n\n'
            + 'Two colours is the usual bug: it reports false cycles on a diamond.',
    },
];
