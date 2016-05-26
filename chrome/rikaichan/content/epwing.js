/*
  Rikaisama
  Copyright (C) Christopher Brochtrup
  Contact: cb4960@gmail.com
  Website: http://rikaisama.sourceforge.net/

  This program is free software; you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation; either version 2 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program; if not, write to the Free Software
  Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA

  ---

  Please do not change or remove any of the copyrights or links to web pages
  when modifying any of the files.
*/

var rcxEpwing =
{
  id: '{697F6AFE-5321-4DE1-BFE6-4471C3721BD4}', // ID of the Rikaisama extension.
  lookupInProgress: false, // true = A lookup is currently in progress.
  paramDicPath:  '',       // Path of EPWING dictionary
  paramWordList: '',       // Word list to lookup
  paramCallback: null,     // Routine to call when all results have been obtained
  resultsList:   [],       // List of results
  curResultIdx:  0,        // Index of word in paramWordList that is currently being looked up
  maxResults:    0,        // Maximum number of words to lookup


  /* Lookup title of the specified EPWING dictionary. Asynchronous.

     Parameters:
       string dicPath  - Full path to an EPWING dictionary.
       string callback - Routine to call when title has been obtained.

     Returns: None.
  */
  lookupTitle: function(dicPath, callback)
  {
    if(rcxEpwing.lookupInProgress)
    {
      return;
    }

    rcxEpwing.paramDicPath = dicPath.replace(/^(.*)[\\\/].*$/, '$1'); // Remove the filename
    rcxEpwing.paramCallback = callback;
    rcxEpwing.resultsList = [];
    rcxEpwing.curResultIdx = 0;
    rcxEpwing.maxResults = 1;

    var argList = ["--title"];

    rcxEpwing.lookupInProgress = true;

    try
    {
      this.doEplkup(rcxEpwing.paramDicPath, "", argList, rcxEpwing.privLookupTitleCallback);
    }
    catch(ex)
    {
      rcxEpwing.paramCallback("???");
    }
  }, /* lookupTitle */


  /* Called by doEplkup() when the title has been obtained.
     Calls the callback routine that was passed to lookupTitle(). */
  privLookupTitleCallback: function(resultText)
  {
    rcxEpwing.lookupInProgress = false;

    var title = "???";

    if(resultText != "Error")
    {
      title = resultText;
    }

    rcxEpwing.paramCallback(title);

  }, /* privLookupTitleCallback */


  /* Lookup list of words from the specified EPWING dictionary. Asynchronous.

     Parameters:
       string dicPath    - Full path to an EPWING dictionary.
       string[] wordList - List of words to lookup.
       fn callback       - Routine to call when title has been obtained.
                           Format: void callback(title)

     Returns: None.
  */
  lookupWords: function(dicPath, wordList, callback)
  {
    if(rcxEpwing.lookupInProgress)
    {
      return;
    }

    rcxEpwing.paramDicPath = dicPath.replace(/^(.*)[\\\/].*$/, '$1'); // Remove the filename
    rcxEpwing.paramWordList = wordList;
    rcxEpwing.paramCallback = callback;
    rcxEpwing.resultsList = [];
    rcxEpwing.curResultIdx = 0;
    rcxEpwing.maxResults = wordList.length;

    if(rcxEpwing.maxResults == 0)
    {
      return;
    }

    rcxEpwing.lookupInProgress = true;

    rcxEpwing.privLookupWordsPart2();

  },  /* lookupWords */


  /* Calls doEplkup() with the current word to lookup. */
  privLookupWordsPart2: function()
  {
    var curWord = rcxEpwing.paramWordList[rcxEpwing.curResultIdx];

    var argList = ["--gaiji", 1, "--hit-num", "--html-sub", "--html-sup", "--no-header"];

    try
    {
      this.doEplkup(rcxEpwing.paramDicPath, curWord, argList, rcxEpwing.privLookupWordsCallback);
    }
    catch(ex)
    {
      // Don't care
    }
  }, /* privLookupWordsPart2 */


  /* Called by doEplkup() when a word has been looked-up. If all words have been
     looked-up, then calls the callback routine that was passed to lookupWords(). */
  privLookupWordsCallback: function(resultText)
  {
    if((resultText != "Error") && (resultText.length > 0))
    {
      rcxEpwing.resultsList.push(resultText);
    }

    rcxEpwing.curResultIdx++;

    // Are there any many words to lookup?
    if(rcxEpwing.curResultIdx >= rcxEpwing.maxResults)
    {
      rcxEpwing.lookupInProgress = false;
      rcxEpwing.paramCallback(rcxEpwing.resultsList);
    }
    else
    {
      // Lookup the next word
      rcxEpwing.privLookupWordsPart2();
    }
  }, /* privLookupWordsCallback */


  /* Call eplkup.exe with the provided arguments. Asynchronous.

     Parameters:
       string dicPath   - Path to the dictionary (not including CATALOGS).
       string inputText - Text to write to the input file that is passed to eplkup.exe.
       string[] argList - eplkup.exe arguments to use. Don't add the final 3 arguments,
                          this routine will do it for you.
       fn callback      - Routine to call when eplkup.exe completes.
                          Format: void callback(resultText)

     Returns: None.
  */
  doEplkup: function(dicPath, inputText, argList, callback)
  {
    // Get a string identifying the current OS
    let osString = Components.classes["@mozilla.org/xre/app-info;1"]
      .getService(Components.interfaces.nsIXULRuntime).OS;

    // For Linux, should we use Wine with the Windows exe instead of the native Linux exe?
    let prefs = new rcxPrefs();
		let useWine = prefs.getBool('epwingusewine');

    // Create the file object that contains the location of eplkup(.exe)
    let eplkupTool = Components.classes["@mozilla.org/file/directory_service;1"]
      .getService(Components.interfaces.nsIProperties)
      .get("ProfD", Components.interfaces.nsILocalFile);
    eplkupTool.append("extensions");
    eplkupTool.append(rcxEpwing.id); // GUID of extension
    eplkupTool.append("epwing");

    if ((osString === 'WINNT') 
      || (useWine && (osString === 'Linux')))
    {
      eplkupTool.append("windows");
      eplkupTool.append("eplkup.exe");
    }
    else if (osString === 'Linux')
    {
      eplkupTool.append("linux");
      eplkupTool.append("eplkup");
    }
    else if (osString === 'Darwin')
    {
      eplkupTool.append("osx");
      eplkupTool.append("eplkup");
    }

    // Does the EPWING lookup tool exist?
    if(!eplkupTool.exists())
    {
      callback("Error");
      return;
    }
    
    eplkupTool.permissions = 0744;

    // Create a temporary directory to place the output of eplkup.exe
    var tmpDir = Components.classes["@mozilla.org/file/directory_service;1"]
      .getService(Components.interfaces.nsIProperties)
      .get("TmpD", Components.interfaces.nsIFile);
    tmpDir.append("rikaisama");

    // Create the input file to eplkup.exe
    var epwingInputFile = Components.classes["@mozilla.org/file/local;1"]
      .createInstance(Components.interfaces.nsILocalFile);
    epwingInputFile.initWithPath(tmpDir.path + "_epwing_in.txt");

    try
    {
      // Remove the input file if it exists
      if(epwingInputFile.exists())
      {
        epwingInputFile.remove(false);
      }

      epwingInputFile.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);
    }
    catch(ex)
    {
      callback("Error");
      return;
    }

    // Create the output file from the EPWING lookup tool
    var epwingOutputFile = Components.classes["@mozilla.org/file/local;1"]
      .createInstance(Components.interfaces.nsILocalFile);
    epwingOutputFile.initWithPath(tmpDir.path + "_epwing_out.txt");

    try
    {
      // Remove the output file if it exists
      if(epwingOutputFile.exists())
      {
        epwingOutputFile.remove(false);
      }

      epwingOutputFile.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);
    }
    catch(ex)
    {
      callback("Error");
      return;
    }

    // Open a safe file output stream for writing
    var ostream = FileUtils.openSafeFileOutputStream(epwingInputFile)

    // Convert the filename Unicode string to an input stream
    var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
      .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";
    var istream = converter.convertToInputStream(inputText);

    // Asynchronously write the input to the input file
    NetUtil.asyncCopy(istream, ostream, function(status)
    { // This function will be called when the write to the input file is complete
      if (!Components.isSuccessCode(status))
      {
        callback("Error");
        return;
      }

      if (useWine && (osString === 'Linux'))
      {
        // Create the file object that contains the location of the
        // bash script that will call eplkup with wine
        var eplkupToolDriver = Components.classes["@mozilla.org/file/directory_service;1"]
          .getService(Components.interfaces.nsIProperties)
          .get("ProfD", Components.interfaces.nsILocalFile);
        eplkupToolDriver.append("extensions");
        eplkupToolDriver.append(rcxEpwing.id); // GUID of extension
        eplkupToolDriver.append("epwing");
        eplkupToolDriver.append("windows");
        eplkupToolDriver.append("run_eplkup.sh");

        eplkupToolDriver.permissions = 0744;

        // Create the process object that will use the bash script
        var process = Components.classes['@mozilla.org/process/util;1']
         .createInstance(Components.interfaces.nsIProcess);
        process.init(eplkupToolDriver);

        // Create the arguments to the bash script
        var eplkupArgs = argList;
        argList.unshift(eplkupTool.path);
      }
      else // Don't use Wine
      {
        // Create the process object that will use eplkup
        var process = Components.classes['@mozilla.org/process/util;1']
          .createInstance(Components.interfaces.nsIProcess);
        process.init(eplkupTool);

        // Create the arguments to eplkup.exe
        var eplkupArgs = argList;
      }

      eplkupArgs.push(dicPath);
      eplkupArgs.push(epwingInputFile.path);
      eplkupArgs.push(epwingOutputFile.path);

      // Lookup the search term with eplkup.exe
      process.runAsync(eplkupArgs, eplkupArgs.length,
      {
        observe: function(process, finishState, unused)
        {
          // Did the lookup finish?
          if (finishState == "process-finished")
          {
            // Read the output file that contains the lookup
            NetUtil.asyncFetch(epwingOutputFile, function(inputStream, status)
            {
              var epwingText = "";

              if (Components.isSuccessCode(status))
              {
                try
                {
                  epwingText = NetUtil.readInputStreamToString(inputStream, inputStream.available());

                  // Convert the EPWING result text to UTF-8
                  var EpwingTextConverter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].
                  createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
                  EpwingTextConverter.charset = "UTF-8";
                  epwingText = EpwingTextConverter.ConvertToUnicode(epwingText);

                  // We're done! Call the callback routine.
                  callback(epwingText);
                  return;
                }
                catch(ex)
                {
                  callback("Error");
                  return;
                }
              }
            });
          }
          else
          {
            callback("Error");
            return;
          }
        }
      });
    });
  },
}; /* doEplkup */
