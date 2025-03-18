# zhin-next
zhin next version, driven by NodeJS (esm)
## Usage
### 1. init NodeJS project
```
npm init -y
```
### 2. install zhin-next
```
npm install zhin-next
```
### 3. add script in package.json
```json
{
  "scripts": {
    "start": "zhin"
  }
}
```
### 4. add zhin.config.yml
```yaml
log_level: info # log level
plugin_dirs: # plugin directories
  - ./plugins 
plugins: # enabled plugins
  - adapter-terminal
  - hello
bots: # bot list
  - adapter: terminal
    title: 命令行
```
### 5. create plugin
#### 5.1 create plugin directory
```shell
mkdir plugins
```
#### 5.2 create plugin file
```shell
touch plugins/hello.js
```
#### 5.3 edit plugin file
```javascript
import { definePlugin } from 'zhin-next';
import {Directive} from "@zhinjs/directive";
const testDirective=new Directive('test')
	.handle(()=>'hello world')
export default definePlugin({
    name: 'hello',// plugin name
	directives:[Test],
    weight: 0,// plugin weight
})
    .directive('foo','bar')
    .directive('hello', async (match, event) => {
		return `hi ${event.user_name}`
    })
```
### 6. start zhin
```shell
npm start
```
### 7. test
```shell
hello
# hi developer
foo
# bar
test
# hello world
```
