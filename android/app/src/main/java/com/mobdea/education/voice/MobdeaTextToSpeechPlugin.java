package com.mobdea.education.voice;
import android.media.AudioAttributes;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(name="MobdeaTextToSpeech")
public class MobdeaTextToSpeechPlugin extends Plugin implements TextToSpeech.OnInitListener {
  private static final String PROJECT12_TABLET_TTS_V1="PROJECT12_TABLET_TTS_V1";
  private final Handler handler=new Handler(Looper.getMainLooper());
  private final ConcurrentHashMap<String,PluginCall> pending=new ConcurrentHashMap<>();
  private TextToSpeech engine; private volatile boolean ready=false;
  @Override public void load(){super.load();getActivity().runOnUiThread(()->engine=new TextToSpeech(getContext().getApplicationContext(),this));}
  @Override public void onInit(int status){
    ready=status==TextToSpeech.SUCCESS&&engine!=null;if(!ready)return;
    engine.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
    selectArabic("ar-EG");
    engine.setOnUtteranceProgressListener(new UtteranceProgressListener(){
      @Override public void onStart(String id){PluginCall c=pending.remove(id);if(c!=null){JSObject r=new JSObject();r.put("ok",true);r.put("started",true);r.put("utteranceId",id);c.resolve(r);}}
      @Override public void onDone(String id){PluginCall c=pending.remove(id);if(c!=null){JSObject r=new JSObject();r.put("ok",true);r.put("started",true);r.put("done",true);c.resolve(r);}}
      @Override public void onError(String id){PluginCall c=pending.remove(id);if(c!=null)c.reject("Android TTS playback error.");}
      @Override public void onError(String id,int code){PluginCall c=pending.remove(id);if(c!=null)c.reject("Android TTS playback error: "+code);}
    });
  }
  private boolean selectArabic(String language){
    if(engine==null)return false;String[] p=String.valueOf(language).replace('_','-').split("-",2);
    Locale requested=p.length>1?new Locale(p[0],p[1]):new Locale(p[0]);
    Locale[] candidates=new Locale[]{requested,new Locale("ar","EG"),new Locale("ar","SA"),new Locale("ar")};
    for(Locale locale:candidates){if(engine.isLanguageAvailable(locale)>=TextToSpeech.LANG_AVAILABLE){int result=engine.setLanguage(locale);if(result!=TextToSpeech.LANG_MISSING_DATA&&result!=TextToSpeech.LANG_NOT_SUPPORTED)return true;}}
    return false;
  }
  @PluginMethod public void speak(PluginCall call){String text=call.getString("text","").trim();if(text.isEmpty()){call.reject("Speech text is required.");return;}getActivity().runOnUiThread(()->speakReady(call,text,0));}
  private void speakReady(PluginCall call,String text,int attempt){
    if(!ready||engine==null){if(attempt<24){handler.postDelayed(()->speakReady(call,text,attempt+1),125);return;}call.reject("Arabic Android TTS is not ready.");return;}
    if(!selectArabic(call.getString("language","ar-EG"))){call.reject("No Arabic Android TTS voice is installed.");return;}
    Double rate=call.getDouble("rate",.94d),pitch=call.getDouble("pitch",1d),volume=call.getDouble("volume",1d);
    engine.setSpeechRate(Math.max(.5f,Math.min(1.5f,rate.floatValue())));engine.setPitch(Math.max(.5f,Math.min(1.5f,pitch.floatValue())));
    Bundle params=new Bundle();params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME,Math.max(0f,Math.min(1f,volume.floatValue())));
    String id="mobdea-"+UUID.randomUUID();pending.put(id,call);
    if(engine.speak(text,TextToSpeech.QUEUE_FLUSH,params,id)==TextToSpeech.ERROR){pending.remove(id);call.reject("Android could not start Arabic speech.");return;}
    handler.postDelayed(()->{PluginCall c=pending.remove(id);if(c!=null)c.reject("Android TTS did not confirm speech start.");},5000);
  }
  @PluginMethod public void diagnose(PluginCall call){getActivity().runOnUiThread(()->{JSObject r=new JSObject();r.put("project",PROJECT12_TABLET_TTS_V1);r.put("ready",ready&&engine!=null);boolean arabic=engine!=null&&(engine.isLanguageAvailable(new Locale("ar","EG"))>=TextToSpeech.LANG_AVAILABLE||engine.isLanguageAvailable(new Locale("ar"))>=TextToSpeech.LANG_AVAILABLE);r.put("arabicAvailable",arabic);int voices=0;if(engine!=null&&engine.getVoices()!=null)for(android.speech.tts.Voice voice:engine.getVoices())if(voice.getLocale()!=null&&"ar".equalsIgnoreCase(voice.getLocale().getLanguage()))voices++;r.put("arabicVoices",voices);call.resolve(r);});}
  @PluginMethod public void stop(PluginCall call){getActivity().runOnUiThread(()->{if(engine!=null)engine.stop();pending.clear();call.resolve();});}
  @Override protected void handleOnDestroy(){pending.clear();if(engine!=null){engine.stop();engine.shutdown();engine=null;}ready=false;super.handleOnDestroy();}
}
