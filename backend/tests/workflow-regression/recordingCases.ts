import {
  classifyRecordedNavigation,
  createRecordedMarkEvent,
  RecordingPageHistoryState
} from '../../src/services/BrowserRecorder';
import { assert } from './helpers';

export interface RecordingRegressionCase {
  name: string;
  run: () => void;
}

export function buildRecordingRegressionCases(): RecordingRegressionCase[] {
  return [
    {
      name: 'recording-mark-event-preserves-selector-and-field',
      run: () => {
        const event = createRecordedMarkEvent(
          {
            pageId: 'page-1',
            url: 'https://example.com/detail',
            title: 'Example',
            selector: '.card > img',
            elementMeta: { tagName: 'img', src: 'https://example.com/a.png' }
          },
          {
            fieldName: 'cover',
            fieldType: 'image'
          }
        );

        assert(event.kind === 'mark', 'recording mark event should be mark kind');
        assert(event.action === 'field-mark', 'recording mark event should use field-mark action');
        assert(event.selector === '.card > img', 'recording mark event should preserve selector');
        assert(event.fieldName === 'cover', 'recording mark event should preserve field name');
        assert(event.fieldType === 'image', 'recording mark event should preserve field type');
      }
    },
    {
      name: 'recording-mark-event-keeps-page-context',
      run: () => {
        const event = createRecordedMarkEvent(
          {
            pageId: 'page-2',
            url: 'https://example.com/article/1',
            title: 'Article',
            selector: 'article h1'
          },
          {
            fieldName: 'title',
            fieldType: 'text'
          }
        );

        assert(event.pageId === 'page-2', 'recording mark event should preserve page id');
        assert(event.url === 'https://example.com/article/1', 'recording mark event should preserve url');
        assert(event.title === 'Article', 'recording mark event should preserve title');
      }
    },
    {
      name: 'recording-navigation-classifies-back-and-forward',
      run: () => {
        let state: RecordingPageHistoryState | undefined;

        let result = classifyRecordedNavigation(state, 'https://example.com/list');
        state = result.nextState;
        assert(result.action === 'navigate', 'first navigation should be navigate');

        result = classifyRecordedNavigation(state, 'https://example.com/detail');
        state = result.nextState;
        assert(result.action === 'navigate', 'new url should be navigate');

        result = classifyRecordedNavigation(state, 'https://example.com/list');
        state = result.nextState;
        assert(result.action === 'back', 'returning to previous url should classify as back');

        result = classifyRecordedNavigation(state, 'https://example.com/detail');
        state = result.nextState;
        assert(result.action === 'forward', 'going to next known url should classify as forward');
      }
    }
  ];
}
