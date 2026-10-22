/* eslint-disable no-restricted-imports -- Real series ownership integration test. */
import "fake-indexeddb/auto";
import { cleanup,fireEvent,render,screen,waitFor } from "@testing-library/react";
import { afterEach,expect,it,vi } from "vitest";
import { MemoryRouter,Route,Routes } from "react-router-dom";
import { db } from "@/infrastructure/dexie/db";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nContext,translate } from "@/lib/i18n";
import EditTaskPage from "./EditTaskPage";
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("edits the series root rule from a child without copying it onto the child",async()=>{
 vi.stubGlobal("ResizeObserver",class{observe(){}unobserve(){}disconnect(){}});
 await db.delete();await db.open();configurePresentationQueries(dexiePresentationReads);
 await db.subjects.add({ id:1,name:"Piano",type:"instrument",createdAt:1 });
 const rule={ enabled:true,successes:3,minConfidence:4,increase:{kind:"percent" as const,value:3} };
 const task={ subjectId:1,title:"Scale",date:"2026-10-22",plan:[],done:false,createdAt:1 };
 await db.tasks.add({...task,id:1,recurrence:{kind:"interval",startDate:task.date,everyXDays:1},tempoRule:rule,tempoRuleRevision:1});
 await db.tasks.add({...task,id:2,recurrenceTaskId:1});
 render(<I18nContext.Provider value={{lang:"it",setLang:()=>{},t:(k,v)=>translate("it",k,v)}}><MemoryRouter initialEntries={['/tasks/edit/2']}><Routes><Route path="/tasks/edit/:id" element={<EditTaskPage/>}/></Routes></MemoryRouter></I18nContext.Provider>);
 expect(await screen.findByText("Regola della serie")).toBeVisible();
 fireEvent.change(screen.getByLabelText("Successi necessari"),{target:{value:"5"}});
 fireEvent.click(screen.getByRole("button",{name:"Salva"}));
 await waitFor(async()=>expect((await db.tasks.get(1))?.tempoRule?.successes).toBe(5));
 expect((await db.tasks.get(2))?.tempoRule).toBeUndefined();
 expect((await db.tasks.get(2))?.customized).toBeUndefined();
});

it("protects a manually edited recurrence occurrence from future tempo updates",async()=>{
 vi.stubGlobal("ResizeObserver",class{observe(){}unobserve(){}disconnect(){}});
 await db.delete();await db.open();configurePresentationQueries(dexiePresentationReads);
 await db.subjects.add({id:1,name:"Piano",type:"instrument",createdAt:1});
 const task={subjectId:1,title:"Scale",date:"2026-10-22",plan:[{layers:[],techniques:[]}],done:false,createdAt:1};
 await db.tasks.add({...task,id:1,recurrence:{kind:"interval",startDate:task.date,everyXDays:1}});
 await db.tasks.add({...task,id:2,recurrenceTaskId:1});
 render(<I18nContext.Provider value={{lang:"it",setLang:()=>{},t:(k,v)=>translate("it",k,v)}}><MemoryRouter initialEntries={['/tasks/edit/2']}><Routes><Route path="/tasks/edit/:id" element={<EditTaskPage/>}/></Routes></MemoryRouter></I18nContext.Provider>);
 fireEvent.change(await screen.findByRole("textbox",{name:"Titolo"}),{target:{value:"Personalized scales"}});
 fireEvent.click(screen.getByRole("button",{name:"Salva"}));
 await waitFor(async()=>expect((await db.tasks.get(2))?.customized).toBe(true));
});
