import { createCalculatorClient } from './api/client'
import { Calculator } from './components/Calculator'

const client = createCalculatorClient()

export default function App() {
  return <Calculator client={client} />
}
