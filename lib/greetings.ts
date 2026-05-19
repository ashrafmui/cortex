import greetings from './greetings.json'

export function getGreeting(name?: string): string {
  const pool = name
    ? greetings
    : greetings.filter((g) => !g.includes('{name}'))
  const pick = pool[Math.floor(Math.random() * pool.length)]
  return name ? pick.replace(/\{name\}/g, name) : pick
}
