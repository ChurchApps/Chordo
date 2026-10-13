// Custom lightweight polyfills for older browsers (iOS 15 / Safari 15 - 16.3)

// 1. ElementInternals stub for @material/web custom elements (iOS < 16.4)
if (typeof HTMLElement !== "undefined" && !HTMLElement.prototype.attachInternals) {
    HTMLElement.prototype.attachInternals = function () {
        const el = this
        return {
            role: null,
            get form() {
                return (el as Element).closest ? (el as Element).closest("form") : null
            },
            get labels() {
                if (!el.id) return []
                return (el.getRootNode?.() as Document | ShadowRoot | undefined)?.querySelectorAll?.(`label[for="${el.id}"]`) ?? []
            },
            setFormValue() {},
            setValidity() {},
            checkValidity() {
                return true
            },
            reportValidity() {
                return true
            },
            validity: {
                valid: true,
                badInput: false,
                customError: false,
                patternMismatch: false,
                rangeOverflow: false,
                rangeUnderflow: false,
                stepMismatch: false,
                tooLong: false,
                tooShort: false,
                typeMismatch: false,
                valueMissing: false
            },
            validationMessage: "",
            willValidate: false,
            states: new Set()
        } as unknown as ElementInternals
    }
}

// 2. Promise.withResolvers (iOS < 17.4)
if (typeof (Promise as any).withResolvers === "undefined") {
    ;(Promise as any).withResolvers = function <T>() {
        let resolve!: (value: T | PromiseLike<T>) => void
        let reject!: (reason?: any) => void
        const promise = new Promise<T>((res, rej) => {
            resolve = res
            reject = rej
        })
        return { promise, resolve, reject }
    }
}
