// Presentation video and its YouTube auto-generated transcript, VERBATIM.
// The transcript is one line per YouTube caption segment: "m:ss text". The words are exactly what YouTube's
// speech recognition produced (including its mishearings, e.g. "clawed code" = Claude Code); only YouTube's
// duplicated screen-reader time label (e.g. "1 minute, 1 second") was removed from each line when copying.
export const VIDEO = {
  youtubeId: 'SKINf0_tK18',
  recordedOn: '2026-11-28',
  transcript: `0:01 Hey guys, it's Andrew uh back again. Uh this time we're going to be talking about um my individual AI project for
0:08 process dynamic and controls um which I've titled closing the loop um which is just an artificial pancreas uh control
0:16 simulator. Um so what I did is very similar to um my other project where I planned it, had it critiqued, um built
0:25 with AI models and then I also um I'll show you the control engineering of it
0:31 all and how the work was organized and um one thing just up front before we move on to anything is that
0:40 um this website and everything in it is for um just educational process controls. uh models only um and it isn't for medical device or dosing decisions.
0:53 So take that with a grain of salt and it's basically posted everywhere on the slides and on the website. So
1:01 um so we're going to start with three numbers. Um our first number is uh 26 which is just
1:09 how many um accept decisions I used um on the critique of Claude's plan. Um I accepted 22 of those and then I um
1:19 accepted three with uh change and that I picked and I rejected one. Um we have 33
1:27 out of 33 which is um the test that both AI built websites uh passed on the first
1:34 run. So, both Gemini and Claude um passed all uh build requirements on the first try, which is good and expected.
1:44 And our last number is 40, which is the um amount of prompts that I logged with
1:51 um clawed code mainly I think um and uh with every decision and its reasoning.
1:59 So on slide three here we have um the overall engineering problem or our uh loop here that we have which is
2:07 basically uh like example 23.3 and 23 or exercise 23.6 from the book.
2:18 Um, I thought this was a good uh a good thing to go with because I really liked the
2:26 um how it was like bio-engineering of it all and how it played more with um anatomy and stuff rather than just being
2:35 about um engineering I guess. So that's why I picked it. I thought it was a really good example. Um so the controlled uh variable in this case will
2:44 be glucose. um in your manipulated variable is going to be your insulin pump rate and the disturbance will be when you eat or a meal.
2:54 And our process gain or a KP is about 4.5 um milligrams per deciliter for every
3:02 millunit um per minute of insulin. And it's going to be negative because more insulin means less glucose.
3:11 And we want glucose to stay inside the textbook band given um which is 54 to 144 milligrams per deciliter.
3:23 Um what makes this uh hard is the measurement. So uh the glucose sensor
3:31 reports 10 minutes late uh and only every five minutes. So the controller is always going to be looking at your past
3:39 and never at um the future or at the current time. I guess I can't really look at the future, but um I do have a note written down here that the
3:47 controlled variable is what we want to hold, which is the glucose, and our manipulated variable is what we can move. So our insulin rate disturbance is
3:54 what pushes off um the meal, which I said earlier, but kind of helps you figure things out a little bit.
4:01 So um building this taught me six lessons, four about control, two about AI. If you've seen the separations video, very similar to that. So moving
4:11 on to our first lesson is that feedback um alone reacts too slow or too late. Um
4:18 so this is a P controller with the IMC method at a closed time loop which is
4:24 our constant t C of 20 minutes. um that meal will raise your glucose almost
4:32 right away, but the sensor will only always see it 10 minutes late and um insulin then has to pass through two
4:39 lags as well. Um one of which is like 35 minutes and the other one around 11 before it will actually lure that
4:47 glucose reading inside the body. And so by the time that controller will answer um that glucose
4:54 has already peaked at around 163 and um above the band and then insulin keeps working after the meal is gone and
5:02 glucose will shoot to um 49 um below the band as you can see and
5:10 feedback can only correct an error after it shows up and here it shows up late as you can see.
5:17 Um, so slide six, that was our first, excuse me, that was our first lesson.
5:23 Um, so our second lesson is going to be that the pump only pushes one way. Um, so insulin delivery is limited between
5:31 zero to 115 millits per minute. So insulin is in the body. Nothing is going to pull
5:39 that back out once it's administered um because this model has no glycogen or gluccogen. So um that the new no
5:48 gluccoagen is what is going to um bond to that insulin and um make it go away. So um at the resting
5:56 uh basil rate of 16.7 at 16.7 um the pump can add almost 100 but it can only cut 16.7.
6:09 Uh that makes the control authority very uh lopsided. uh when the output hits a limit, the integral term keeps adding up
6:18 error it can't act on. Um that's called the windup. So it causes a big overshoot um on the way back down.
6:26 So here the meal is twice the textbook size. Um, with the anti- windup off, it's the the lowest glucose is 39.1.
6:35 With clamping, it's 45 and with the back calculation, it's
6:41 43.3 milligs per deciliter. So, anti- windup helps, but um, nothing fully fixes a one-way actuator as you can see.
6:51 So, that was my second lesson. in the third lesson um about uh
7:00 controls here was that feedback acts before the error. So a meal disturbance can measure ahead of time. Um we know
7:08 when it's coming and how big it's going to be. So instead of waiting uh for the error um so instead of uh waiting for the
7:17 error sorry okay sorry I got another text um we cancel the meal directly um the
7:25 static forward feed gain is KF equals uh negative KD over KP um the disturbance gain divided by the
7:34 process gain will with a negative sign so the two will cancel out giving that uh insulin as a bulis uh right at the
7:41 meal drop the drops the meal peak from 163 to 139
7:51 giving it 15 minutes before the meal uh does much better the peak is 108 uh and
7:57 the natter is 62 or the um minimum that stays inside the band the whole time because the insulin has time to get
8:05 through its legs before that glucose arrives.
8:08 Okay, our last lesson for um this part is that delay sets the limit. So um dead
8:16 time like the sensor delay adds a lag phase without changing the gain. So it
8:23 eats up the phase margin. Um at a talc of 20 minutes, uh the phase margin is 74 without the sensor delay and then it's
8:32 uh 58.6° with it. Um how much total delay?
8:37 Excuse me. How much total delay can we get? So you can see the total delay the loop tolerates is going to be 41 or 48.1
8:44 minute minutes. Um running the actual um sim sampled simulation they got 43.4
8:53 minutes because sampling every 5 minutes adds that own lag. Um so more delay than that. Um the loop oscillates on its own.
9:02 So that was our final um lesson for the um model and control of it all. So now uh lesson five is going to be about AI.
9:14 Um so similar to separations um one model planned another critiqued um
9:22 quad opus 5.5 wrote the plan version one and Gemini flash 3.5 uh critiqued it and
9:30 we had 11 findings uh plus answers to seven open uh questions and before deciding every finding was fact checked against a independent Python version of
9:39 the model and then I made all 26 decision decisions um given through cloud code and the best
9:48 catch that I have written down here was a set point uh waiting bug at rest with the weight beta at.5 the glucose fell
9:56 from 81 to 57.3 with no meal um that was a mistake on Claude's part and
10:06 um its code did catch that which is good. Um so the one rejection that you see here um was when Gemini called the
10:13 back calculation formula formula a subtle algebraic error um but then its own derivation actually showed the formula was correct which made no sense.
10:23 So that was the one rejection that I called. Um so the last lesson
10:30 that I have here is that um two builds same tests uh with the same plan prompt and test called code and Gemini um
10:39 command line tool each built the website and then they both passed the 33 out of 33 um on the first run like I said
10:46 earlier um Gemini did build faster because I mean it's flash so it's going to build fast. Um so Cloud Code took
10:55 around 27 minutes to build everything which is pretty long. Uh Gemini built uh
11:01 in just 16. Um its engine runs about two times as quick as um Anthropics Opus 5.5
11:09 on quad code. Um passing isn't the same as just correct though as we know. So, Gemini's P versus NPC um chart plotted
11:18 no data and the test didn't catch it because they only fact checked a chart, one chart. So, I added context that
11:25 checks um each chart and its plot. And Claude site also had far more of the math on screen, very similar to the
11:34 separations one, which seems to be something that um Gemini just doesn't understand. So the 51 equation blocks um
11:42 you can see compared to um Gemini's nine, excuse me.
11:49 Um so basically a recap on everything is that um feedback reacts late, pump
11:56 pushes one way, feed forward acts first, delay sets limit, and then one model critiques while another one plans. Um,
12:06 and two builds same or two builds need more than just passing tests. Um, so to
12:13 kind of get to a conclusion of everything, um, after comparing them, I chose to mainly ship anthropic content.
12:19 Um, claw just always had better um, always had better design and overall building skills for the websites. Um
12:27 what surprised me a lot again was how good Chad GPT is at making mood boards and um UIUX implementation and it was a
12:37 lot better than any of the other aenic um or LLM stuff that I was looking at.
12:44 Um, in process control, I learned how much recycle affects a process. And what I want to do next, um, what I want to
12:53 learn next for the like further my education and everything would be to understand um, LLM better and use GitHub
13:01 pages and cloud to build a homepage for the two websites of these projects and also some other stuff that I've worked on outside of class.
13:10 So now what we're going to do is we're going to jump into the website that you can see here. You can find it here as well. And um I'll switch over to the
13:19 website right now and let you uh take a look. I do have some notes over here on the right. So if you see me looking over at the right, I'm just um it might be
13:27 for like what if scenarios and stuff like that. But um let me get my screen recorded.
13:34 Cool. Um, so what you can see here is uh when you open the um page, the overview
13:40 page, this is what um you'll see. So, um I also have notes down here. Um so what you'll see is you'll have the 3D modeled
13:48 pancreas. This is literally just something I added cuz I was like, "Oh, I want to try if I can add a 3D model." This is just something I wanted to try, which was successful. It's a little
13:55 laggy. Um but it's I mean it could be way worse. Like you can see it's it's pretty laggy when you're dragging it itself, but I mean it's not too bad. It
14:04 could be a lot worse. The one actually down lower here. Um actually I think works better. Like it's
14:13 way Oh yeah, it is way better. Um you can see it like actually is way faster.
14:17 It has more interactable menus and stuff. Not that that matters anyways.
14:20 Doesn't matter. Just kind of cool. I thought um so um
14:26 this kind of so you sorry the pancreas is real 3D anatomy data from a
14:33 uh public database um in Tokyo that I took it from that I found um and the glowing dots are the schematic tests um
14:41 or the schematic sorry uh islets and the cells that release uh the insulin on the pancreas actually and the glow um
14:49 follows the insulin right from the simulation and the small uh chart uh traces that same glucagen run and then
14:56 you can see this loop diagram here. Um whole process is just one feedback loop.
15:01 Um meal obviously going to raise your glucose in your body and then um this sensor measures it late and then
15:09 goes to your controller which is a discrete P's going to deliver insulin and then your um insulin is going to bring your
15:16 glucose back down. Um I'm going to scroll past these four chapters.
15:24 Um yeah. Okay. So then last um the four chapters below here are just like the same control lessons from the slides. So
15:31 I'm going to skip them. Um here you can explore like I said the organ itself. Um just context nothing really about
15:39 anything um useful. So, so um getting into the actual simulator.
15:46 Um we're just going to start with the default here. Um so the simulator is the heart of the site here obviously. Um
15:55 solves the full nonlinear model every time you change something. The top card up here shows the peak. Um, and the nod,
16:05 like I said earlier, which is just um the fancy word for the um bottom.
16:11 And then um those are in red because they leave the band. As you can see, the band is this um lighter green color here. So um there's the top of the band
16:19 and the bottom of the band. And um which is 163 and 49 exactly the lesson one
16:26 case. Um below that, the top chart is glucose. Um
16:33 like right here is glucose. Um the solid line is the true glucose and the stepped line is the what the sensor reports uh
16:41 delayed and sampled. And then under it are the insulin rate and the meal um yeah disturbance. So there you go. Um in
16:49 scenario we're going to do 15minute pre-bolus. So where's the 15 minute? We're going to do 15 minute.
17:00 Okay, there we go. 15-minute pre-bullus.
17:06 Okay, cool. Okay, so um when you switch the feed forward with a 15-minute pre-bololis, the cards you can see will
17:13 turn green um peak 108 basically and um bottom of 62.2 and the run will stay inside the band as you can see.
17:24 Um, you can see the bullets at the tail block and the insulin chart before your meal will arrive.
17:30 Cool. Um, and then when we're going to reset it quick and then we're going to go to our scenario. Um, actually no,
17:38 we're going to go under what is what do I have in control? We're going to go under sensor. Um, sensor.
17:48 So, we're going to go sensor and we're going to go to um actual sensor delay of 0 seconds and then we're going to or 0
17:56 minutes, sorry, I guess. Um so, we're going to drag it from zero kind of just show you guys what it does.
18:04 We're going to go from zero to and drag it up kind of show what's happening here. You can see there's a yellow
18:11 around around 20 or I guess 19 and a half minutes. um we get a flag. So um as
18:19 the delay goes from 10 to 30 to 40 minutes. So 10 to 30 to 40 um the undershoot gets deeper from the 49 down
18:27 to about 30 and the response starts to ring. Um that's lesson four that we went over earlier. The delay will eat your stability margin.
18:36 So, when we um reset this again and we're going to go up to controller and we're going to switch our tuning to manual gains.
18:49 And then we're going to drag our KC to about 1.2.
18:55 So, that's good. And then we're going to Okay, that's about three times the IMC value. So, um, when I tune it by hand,
19:05 you can see if I make the controller about three times more aggressive than your IMC will suggest, um, the loop will start to oscillate. Um, the more gain
19:14 doesn't mean better control when there's dead time. So, finally, what we're going to do is we're going to scroll down to the analysis section down here.
19:23 Okay, so let's reset. I forgot to reset. So, we go down to analysis.
19:32 Um the site also runs these uh trade-offs for you. As you can see, this chart reruns the whole simulation for
19:38 the range of Talc values. Um a small TLC is aggressive and uh with a lower peak
19:45 in a deeper um deeper valley and then a large TLC will be gentle. Um the diamond marks your current setting that it's at.
19:54 So if we go up, this should change it.
19:57 Maybe not. Yeah, there it goes. It's just kind of slow.
20:01 Cool. Um, so we're going to go to control design. Now, we're going to skip through. We'll come back. But our control design,
20:09 excuse me. Um, so we're going to go to um our first
20:15 chapter. We're going to click 05 for our block diagram. And then we're going to click controller block. Yeah. And then the sensor block.
20:25 So here we go. So for um this is our standard closed loop block diagram um that the um that is in our textbook
20:35 in the chapter list on the left you can click um05 that's how you get to it and then uh clicking a block will show it transfer
20:44 function the controller has a P with a KC of about.29 29 or sorry about uh negative.43
20:52 which is negative because the glucose uh calls for more insulin than needed. Um
20:58 the sensor is going to be a pure delay uh e to the negative theta s * s
21:07 um sampled every 5 minutes again. Then we're going to go to our stability margins. Um these four numbers are
21:15 stability margins of phase diagram or a phase margin of 58.6° um and a gain margin of about 3.5
21:23 or I guess here it's 5.9 um both inside our guidelines um but uh
21:32 the plot um shows that where's the plot at?
21:38 There you go. Our plots here show that um show where they come from. the delay keeps adding phase lag as your frequency goes up um while your gain doesn't change.
21:48 So, um, the last or one of the last stops, I guess we got more, but it's our theory tab here. Um,
21:57 you can see our three equations here, um, up top. And then we can go to our
22:04 second one. And you can see that this is just kind of like the model as again theory. Um,
22:13 every card shows its unit and its physical meaning. So if you ever get confused about anything, you can just come here for our AI workflow tab. Um
22:23 just this just documents everything that I was doing over the past few weeks. Um
22:30 just has like a timeline of everything, all 26 decisions here with my reasoning.
22:36 You can go through everything. Um interactable um timeline of literally everything. Um,
22:45 at the bottom down here, it's my own, you can even see prompts and then you can see my own conclusions and what I learned.
22:53 Um, so yeah. Um, I hope that was a good overview of closing the loop. Uh, this
23:02 is again just something I pulled from the textbook that I thought would be different and people would enjoy over maybe something that we've seen a lot.
23:10 So, I uh hope you guys enjoyed watching and again, this isn't medical advice um and not dosing decisions. So, yep.
23:20 Thanks for watching.`,
};
