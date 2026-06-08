export class UserSuspendedError extends Error {
  constructor() {
    super('Esta conta está temporariamente suspensa.')
    this.name = 'UserSuspendedError'
  }
}