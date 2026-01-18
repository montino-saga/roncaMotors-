import { Input } from './Input'
import { formatCLP } from '../../lib/utils'

export function CurrencyInput({ value, onChange, name, placeholder, required, className, ...props }) {

    const handleChange = (e) => {
        // Remove non-numeric characters
        const rawValue = e.target.value.replace(/[^0-9]/g, '')

        // Create synthetic event
        const syntheticEvent = {
            target: {
                name: name,
                value: rawValue
            }
        }

        onChange(syntheticEvent)
    }

    // Format display value
    const displayValue = value ? formatCLP(value) : ''

    return (
        <Input
            {...props}
            name={name}
            value={displayValue}
            onChange={handleChange}
            placeholder={placeholder}
            required={required}
            className={className}
            type="text" // Must be text to allow formatting characters
        />
    )
}
