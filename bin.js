#!/usr/bin/env -S npx tsx
const parseOptions = (args) => {
	const options = {}
	let key = null
	args.forEach((arg) => {
		if (key && arg.startsWith('-')) {
			options[key] = true
			key = arg.replace(/^-+/, '')
		} else if (key) {
			if (options[key]) {
				options[key] = [options[key]]
				options[key].push(arg)
			} else {
				options[key] = arg
			}
			key = null
		} else {
			if (arg.startsWith('-')) {
				key = arg.replace(/^-+/, '')
			} else {
				options[arg] = true
			}
		}
	})
	return options
}
const options = parseOptions(process.argv.slice(2))
const {createZhin}=await import(`./${options.e || 'lib'}/zhin`)
createZhin(options.config||options.c)
	.start()
