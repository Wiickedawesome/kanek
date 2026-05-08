import React from 'react';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- no types ship with react-test-renderer; runtime use only.
import { create } from 'react-test-renderer';
import { ThemeProvider } from '@/theme/ThemeContext';
import { Text } from '@/components/ui/Text';

function render(node: React.ReactNode, scheme: 'light' | 'dark' = 'light') {
  return create(<ThemeProvider forceScheme={scheme}>{node}</ThemeProvider>).toJSON();
}

describe('Text', () => {
  it('renders body/regular/text by default', () => {
    expect(render(<Text>hello</Text>)).toMatchSnapshot();
  });

  it('renders h1 bold', () => {
    expect(render(<Text variant="h1">Title</Text>)).toMatchSnapshot();
  });

  it('renders body medium muted', () => {
    expect(
      render(
        <Text variant="body" weight="medium" tone="muted">
          sub
        </Text>,
      ),
    ).toMatchSnapshot();
  });

  it('renders overline uppercase', () => {
    expect(render(<Text variant="overline">Section</Text>)).toMatchSnapshot();
  });

  it('renders danger tone', () => {
    expect(render(<Text variant="bodySm" tone="danger">err</Text>)).toMatchSnapshot();
  });

  it('renders dark scheme text', () => {
    expect(render(<Text variant="h2">Dark</Text>, 'dark')).toMatchSnapshot();
  });

  it('layout style overrides apply but do not override colour/font', () => {
    const tree = render(
      <Text variant="body" tone="muted" style={{ marginTop: 8, textAlign: 'center' }}>
        x
      </Text>,
    );
    expect(tree).toMatchSnapshot();
  });
});
