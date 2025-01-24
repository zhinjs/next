import {definePlugin} from "../../plugin";
import Test from './directives/test'
export default definePlugin({
    name:'test',
    directives:[Test]
})
    .directive('foo','bar')
    .directive('bar','foo')
