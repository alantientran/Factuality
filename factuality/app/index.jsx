import React, { useState, useRef, useEffect } from "react";
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import useTranscribe from './hooks/useTranscribe';

const MainScreen = () => {
  const [transcription, setTranscription] = useState(""); // Store what's currently being transcribed
  const [previousText, setPreviousText] = useState([]); // "Permanent" storage of text that's been fully fact checked
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [selectedWordDetails, setSelectedWordDetails] = useState("");
  const [claims, setClaims] = useState({}); // All claims that have been made throughout the whole text
  const [currentClaims, setCurrentClaims] = useState({}); // Only the claims for the current parsing cycle
  const [verifyResults, setVerifyResults] = useState({});
  const [processingText, setProcessingText] = useState([]); // Intermediate storage of text that has been parsed but not fact checked
  const [highlightColors, setHighlightColors] = useState({}); // Stores each phrase and the color it should be highlighted (phrase:color pairs)
  const scrollViewRef = useRef(null);
  const [currentClaimsUpdatedByClaim, setCurrentClaimsUpdatedByClaim] = useState(false); // Flag to track update source
  const backendURL = 'http://10.148.246.37:5000';
  const { startTranscribe, 
      stopTranscribe, 
      isRecording, 
      durationMs, 
      size,
      transcript,
      socket
    } = useTranscribe(backendURL);
  
  const handleHighlightPress = (phrase) => {
    const factResult = verifyResults[Object.keys(claims).find(key => claims[key] === phrase)] // fact result object for the given phrase
    if (factResult) {
      setSelectedWordDetails(factResult); // change this to better display the factuality, confidence, context, and sources
    } else {
      setSelectedWordDetails("Loading...");
    }
    setIsPopupVisible(true);
  };

  const claim = async () => {
    socket.on('claim', (claims_obj) => {
      console.log("claims:", claims_obj);
      const newState = {...currentClaims};
      // update claims state
      claims_obj.forEach((pair) => {
        newState[pair['claim']] = pair['source_text']; // stores claim:source_text pairs
      });

      setCurrentClaimsUpdatedByClaim(true);
      setCurrentClaims(newState);
    });
  }

  useEffect(() => {
    // Check if the update comes from the claim
    if (currentClaimsUpdatedByClaim) {
      parseTranscription(transcription);
      console.log("current claims:" + Object.keys(currentClaims));
      console.log("total claims:" + Object.keys(claims));
      // Reset the flag after parsing
      setCurrentClaimsUpdatedByClaim(false);
    }
  }, [currentClaims, currentClaimsUpdatedByClaim]);

  // helper for verify, extracts the text within an element recursively to account for nested objects
  const extractText = (element) => {
    if (React.isValidElement(element)) {
      // If the element has children, check if the child is a <Text> component
      if (element.props.children) {
        if (Array.isArray(element.props.children)) {
          // If children is an array, recurse through it
          return element.props.children.map((child) => extractText(child)).join("");
        } else if (React.isValidElement(element.props.children)) {
          // If there's a single child element, recurse into it
          return extractText(element.props.children);
        } else {
          // If the child is raw text, return it
          return element.props.children;
        }
      }
    }
    return ""; // Default return for non-valid elements
  };

  const verify = async () => {
    socket.on('verify', (verify_obj) => {
      console.log("verify:", verify_obj);

      // change highlight color of the claim's source text to reflect factuality
      const colors = {...highlightColors};
      if (verify_obj['fact_check_result']['factuality'] == 'true') {
        colors[claims[verify_obj['claim']]] = 'green';
      } else if (verify_obj['fact_check_result']['factuality'] == 'false') {
        colors[claims[verify_obj['claim']]] = 'red';
      } else {
        colors[claims[verify_obj['claim']]] = 'yellow';
      }
      setHighlightColors(colors);

      // move all the text until the claim's source text to previousText (it is now completely fact checked, so can be moved to the "permanent" storage)
      const index = processingText.findIndex((element) => {
        const text = extractText(element); // Extract the text from the element
        return text.includes(claims[verify_obj['claim']]); // Check if the text contains the source text
      });
    
      if (index !== -1) {
        // Split the processingText into two parts
        const elementsToMove = processingText.slice(0, index + 1); // Elements to move
        const remainingElements = processingText.slice(index + 1); // Remaining elements
    
        // Update states
        setPreviousText((prev) => [...prev, ...elementsToMove]); // Add to previousText
        setProcessingText(remainingElements); // Update processingText
      } else {
        console.log(`Phrase "${phrase}" not found in processingText.`);
      }

      // update verifyResults state 
      const results = {...verifyResults};
      results[verify_obj['claim']] = verify_obj['fact_check_result'];
      setVerifyResults(results);
    })
  }

  const test = async () => {
    console.log('starting test listening');
    socket.on('test', (test_obj) => {
      console.log(test_obj)
    });
  }

  useEffect(() => {
    if(socket != null) {
      console.log("SOCKET NOT NULL");
      test();
      claim();
      verify();
    }
  }, [socket]);

  useEffect(() => {
    setTranscription(transcription + " " + transcript)
  }, [transcript]);

  const parseTranscription = (text) => {
    const phrasesToHighlight = Object.values(currentClaims);
    console.log("phrases to highlight: " + phrasesToHighlight);
    let result = [];
    let remainingText = text;
    const tempClaims = claims;
    const tempCurrentClaims = currentClaims;

    phrasesToHighlight.forEach((phrase) => {
      const index = remainingText.toLowerCase().indexOf(phrase.toLowerCase());

      if (index !== -1) {
        // Only add a claim to the list of total claims if it has been parsed
        const key = Object.keys(currentClaims).find(key => currentClaims[key] === phrase);
        
        // Add to claims
        tempClaims[key] = phrase;

        // Delete from currentClaims
        delete tempCurrentClaims[key];

        // Split the text into three parts: before, match, and after
        const before = remainingText.slice(0, index);
        const match = remainingText.slice(index, index + phrase.length);
        const after = remainingText.slice(index + phrase.length);

        // Push the parts to the result array
        if (before) result.push(<Text key={`${before}-${Date.now()+1}+${Math.random()}`}>{before}</Text>);
        result.push(
          <Pressable
            key={`${match}-${Date.now()}+${Math.random()}`}
            onPress={() => handleHighlightPress(match)}
            style={[
              styles.highlightBox,
              { backgroundColor: highlightColors[phrase] || "gray" }, // Dynamic color
            ]}
          >
            <Text style={styles.highlightText}>{match}</Text>
          </Pressable>
        );

        // Update remainingText to only the after part
        remainingText = after;
      }
    });

    // Push any remaining unprocessed text
    if (remainingText)
      result.push(<Text key={`${remainingText}-${Date.now()-1}+${Math.random()}`}>{remainingText}</Text>);

    setProcessingText((prevText) => [...prevText, ...result]) // add to processingText
    setTranscription("") // resets transcription
    // Updates claim states
    setClaims(tempClaims);
    setCurrentClaims(tempCurrentClaims);
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <ScrollView 
          ref={scrollViewRef}
          onContentSizeChange={() => 
            scrollViewRef.current?.scrollToEnd({ animated: true })
          }
          style={styles.transcriptionBox}
        >
          <Text>{[...previousText, <Text key={`${processingText}-${Date.now()+1}+${Math.random()}`}>{processingText}</Text>, <Text key={`${transcription}-${Date.now()-1}+${Math.random()}`}>{transcription}</Text>]}</Text>
        </ScrollView>
        {isRecording ? (
            <TouchableOpacity style={styles.button} onPress={stopTranscribe}>
              <Text>{"Stop"}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.button} onPress={() => {startTranscribe();}}>
              <Text>{"Start"}</Text>
            </TouchableOpacity>
        )}
        <Modal visible={isPopupVisible} transparent={true}>
          <View style={styles.popup}>
            <Text>{selectedWordDetails}</Text>
            <TouchableOpacity onPress={() => setIsPopupVisible(false)}>
              <Text>Close</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  transcriptionBox: {
    flex: 1,
    padding: 10,
    backgroundColor: "#ffffffff",
    margin: 10,
    marginTop: -30,
  },
  button: {
    padding: 10,
    backgroundColor: "#007AFF",
    alignItems: "center",
    margin: 10,
    marginBottom: 90,
    borderRadius: 5,
  },
  highlightBox: {
    backgroundColor: "gray",
    borderRadius: 5,
    padding: 2,
    marginHorizontal: 2,
  },
  highlightText: {
    fontWeight: "bold",
    color: "black",
  },
  popup: {
    margin: 20,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});

export default MainScreen;
