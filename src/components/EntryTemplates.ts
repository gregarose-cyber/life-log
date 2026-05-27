export interface TemplateField {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
}

export interface EntryTemplate {
  id: string;
  name: string;
  icon: string;
  fields: TemplateField[];
}

export const TEMPLATES: EntryTemplate[] = [
  {
    id: 'food',
    name: 'Food & Drink',
    icon: '🍽️',
    fields: [
      { key: 'dish', label: 'Dish', placeholder: 'What did you have?' },
      { key: 'restaurant', label: 'Restaurant', placeholder: 'Name of the place' },
      { key: 'location', label: 'Location', placeholder: 'City or neighborhood' },
      { key: 'highlight', label: 'Highlight', placeholder: 'Best part of the meal?', multiline: true },
      { key: 'wouldReturn', label: 'Would return?', placeholder: 'Yes / No / Maybe' },
    ],
  },
  {
    id: 'golf',
    name: 'Golf',
    icon: '⛳',
    fields: [
      { key: 'course', label: 'Course', placeholder: 'Course name' },
      { key: 'score', label: 'Score', placeholder: 'Your score' },
      { key: 'partners', label: 'Playing partners', placeholder: 'Who did you play with?' },
      { key: 'conditions', label: 'Conditions', placeholder: 'Weather, course conditions...' },
      { key: 'highlight', label: 'Highlight', placeholder: 'Best moment of the round?', multiline: true },
    ],
  },
  {
    id: 'movie',
    name: 'Movie / TV',
    icon: '🎬',
    fields: [
      { key: 'title', label: 'Title', placeholder: 'What did you watch?' },
      { key: 'director', label: 'Director / Creator', placeholder: 'Director or showrunner' },
      { key: 'watchedWhere', label: 'Watched where', placeholder: 'Netflix, theater, HBO...' },
      { key: 'take', label: 'One-line take', placeholder: 'Your verdict in one sentence', multiline: true },
    ],
  },
  {
    id: 'place',
    name: 'Place',
    icon: '📍',
    fields: [
      { key: 'city', label: 'City', placeholder: 'Where?' },
      { key: 'reason', label: 'Reason for visit', placeholder: 'Work, vacation, passing through...' },
      { key: 'highlight', label: 'Highlight', placeholder: 'Best thing about the place?', multiline: true },
      { key: 'wouldReturn', label: 'Would return?', placeholder: 'Yes / No / Maybe' },
    ],
  },
];

export function serializeTemplate(template: EntryTemplate, values: Record<string, string>): string {
  const firstField = template.fields[0];
  const title = values[firstField.key]?.trim() ?? '';
  const rest = template.fields.slice(1)
    .filter(f => values[f.key]?.trim())
    .map(f => `${f.label}: ${values[f.key].trim()}`)
    .join('\n');
  return [title, rest].filter(Boolean).join('\n\n');
}
