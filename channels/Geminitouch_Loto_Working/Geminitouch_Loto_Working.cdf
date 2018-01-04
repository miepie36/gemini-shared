<?xml version='1.0' ?>
<Channel platform="QuebecPSP.jar" fcldate="12/27/2017" fclversion="B548" romID="ROM0" cdfW="1080" cdfH="1920" grouping="false">
   <Definitions>
      <observerdef name="LanguagePreferenceObserver" handler="com.gtech.esmultimedia.cdf.extension.LanguagePreferenceObserver" />
      <observerdef name="ParameterImageDataObserver" handler="com.gtech.esmultimedia.cdf.extension.ParameterImageDataObserver" />
      <observerdef name="SignonStateObserver" handler="com.gtech.esmultimedia.cdf.extension.SignonStateObserver" />
      <observerdef name="SystemDateTimeObserver" handler="com.gtech.esmultimedia.cdf.extension.SystemDateTimeObserver" />
      <observerdef name="TerminalGroupsDataObserver" handler="com.gtech.esmultimedia.cdf.extension.TerminalGroupsDataObserver" />
      <observerdef name="TextDataObserver" handler="com.gtech.esmultimedia.cdf.extension.TextDataObserver" />
      <observerdef name="WinnerAwarenessDataObserver" handler="com.gtech.esmultimedia.cdf.extension.WinnerAwarenessDataObserver" />
   </Definitions>
   <Observers>
      <LanguagePreferenceObserver name="LanguagePreferenceObserver" />
      <ParameterImageDataObserver name="ParameterImageDataObserver" />
      <SignonStateObserver name="SignonStateObserver" />
      <SystemDateTimeObserver name="SystemDateTimeObserver" />
      <TerminalGroupsDataObserver name="TerminalGroupsDataObserver" />
      <TextDataObserver name="TextDataObserver" />
      <WinnerAwarenessDataObserver name="WinnerAwarenessDataObserver" />
   </Observers>
   <Show name="channeldefault" contentHandler="" content="channeldefault.sdf" repeat="false" interrupt="true" repeatable="false" persistent="false" active="true" />
   <Show name="LQ_carrousel_1" contentHandler="" content="LQ_carrousel_1.sdf" repeat="true" interrupt="true" repeatable="true" persistent="false" active="true" />
   <Show name="LQ_carrousel_2" contentHandler="" content="LQ_carrousel_2.sdf" repeat="true" interrupt="true" repeatable="true" persistent="false" active="true" />
   <Show name="LQ_carrousel_3" contentHandler="" content="LQ_carrousel_3.sdf" repeat="true" interrupt="true" repeatable="true" persistent="false" active="true" />
   <Show name="attract_show" contentHandler="" content="attract_show.sdf" repeat="false" interrupt="true" repeatable="false" persistent="false" active="true" />
   <Show name="gui" contentHandler="" content="gui.sdf" repeat="false" interrupt="true" repeatable="false" persistent="true" active="true" />
</Channel>
