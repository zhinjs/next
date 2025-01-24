export namespace segment{
    export function escape(v:any){
        if(!v || typeof v==='object') return escape(JSON.stringify(v))
        return String(v)
            .replace(/\[/g,'&#91;')
            .replace(/]/g,'&#93;')
            .replace(/,/g,'&#44;')
            .replace(/=/g,'&#61;')
    }
    export function unescape(v:string){
        const result= v
            .replace(/&#91;/g,'[')
            .replace(/&#93;/g,']')
            .replace(/&#44;/g,',')
            .replace(/&#61;/g,'=')
        try{
            return JSON.parse(result)
        }catch {
            return result
        }
    }
    export function toString(segments:Segment[]){
        return segments.map(segment=>{
            if(segment.type==='text') return segment.data.text
            return `[CQ:${segment.type},${Object.entries(segment.data).map(([k,v])=>`${k}=${escape(v)}`).join(',')}]`
        }).join('')
    }
    export function parse(message:string){
        const segments:Segment[]=[]
        const reg=/\[CQ:([a-zA-Z]+),([^,]+),?([^,]+)?\]/g
        let result:RegExpExecArray|null
        while (result=reg.exec(message)){
            const type=result[1]
            const data:Record<string,any>={}
            result[2].split(',').forEach(item=>{
                const [k,v]=item.split('=')
                data[k]=unescape(v)
            })
            segments.push({type,data})
        }
        return segments
    }
}
export interface Segment{
    type:string
    data:Record<string, any>
}
export namespace Segment{
    type MaybeArray<T> = T | T[]
    export type Sendable=MaybeArray<string|boolean|number|Segment>
    export function format(content:Sendable):Segment[]{
        if(typeof content==='string') return [{type:'text',data:{text:content}}]
        if(typeof content==='boolean') return [{type:'text',data:{text:content?'true':'false'}}]
        if(typeof content==='number') return [{type:'text',data:{text:String(content)}}]
        if(Array.isArray(content)) return content.map(format).flat()
        return [content]
    }
}
