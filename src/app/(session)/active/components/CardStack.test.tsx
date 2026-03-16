import { describe, it } from 'vitest'

describe('CardStack', () => {
  it.todo('renders nothing when cards array is empty')
  it.todo('renders one AnswerCard per card in the array')
  it.todo('stack overflows vertically with max-height constraint')
})

describe('AnswerCard', () => {
  it.todo('shows terseAnswer and cardType label in collapsed state')
  it.todo('toggles to expanded state showing fullAnswer on tap')
  it.todo('shows source link when sourceRef is non-empty')
  it.todo('does not render source link when sourceRef is empty string')
  it.todo('calls onDismiss with card id when swipe gesture completes')
})
