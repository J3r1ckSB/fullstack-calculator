import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import App from './App'
import { messages } from './messages'

it('renders the calculator', () => {
  render(<App />)

  expect(
    screen.getByRole('heading', { level: 1, name: messages.heading }),
  ).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('0')
  expect(
    screen.getByRole('button', { name: messages.keys.equals.name }),
  ).toBeInTheDocument()
})
