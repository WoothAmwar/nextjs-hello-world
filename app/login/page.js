import { login, signup } from './actions'

export default function LoginPage() {
  return (
    <div>
      <form>
        <label htmlFor="email">Email:</label>
        <input id="email" name="email" type="email" required />
        <label htmlFor="password">Password:</label>
        <input id="password" name="password" type="password" required />
        <button formAction={login}>Log in</button>
        <button formAction={signup}>Sign up</button>
      </form>

      <div>
        <p>Example of Input</p>
        <p>am1alted47@gmail.com</p>
        <p>password</p>
      </div>
    </div>
  )
}