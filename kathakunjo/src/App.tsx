import { useEffect, useMemo, useState } from 'react';
import { DnaAnalyzer } from './components/DnaAnalyzer';
import { SavedLibrary } from './components/SavedLibrary';
import { StoryEngine } from './components/StoryEngine';
import { TopBar } from './components/TopBar';
import { TopicLab } from './components/TopicLab';
import type {
  ActiveTab,
  DurationId,
  StoryDnaProfile,
  StoryProject,
  StoryTopic,
} from './types/story';
import { generateBlueprintApi } from './utils/api';
import {
  loadSavedDnas,
  loadSavedProjects,
  loadSavedTopics,
  loadTheme,
  saveDnasList,
  saveProjectsList,
  saveTheme,
  saveTopicsList,
} from './utils/storage';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('topics');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => loadTheme());

  const [generatedTopics, setGeneratedTopics] = useState<StoryTopic[]>([]);
  const [savedTopics, setSavedTopics] = useState<StoryTopic[]>(() =>
    loadSavedTopics()
  );
  const [savedProjects, setSavedProjects] = useState<StoryProject[]>(() =>
    loadSavedProjects()
  );
  const [savedDnas, setSavedDnas] = useState<StoryDnaProfile[]>(() =>
    loadSavedDnas()
  );

  const [activeProject, setActiveProject] = useState<StoryProject | null>(null);
  const [activeDna, setActiveDna] = useState<StoryDnaProfile | null>(null);
  const [isBuildingBlueprint, setIsBuildingBlueprint] = useState(false);
  const [blueprintError, setBlueprintError] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveTheme(theme);
  }, [theme]);

  const savedTopicIds = useMemo(
    () => new Set(savedTopics.map((t) => t.id)),
    [savedTopics]
  );

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleToggleSaveTopic = (topic: StoryTopic) => {
    setSavedTopics((prev) => {
      const exists = prev.some((t) => t.id === topic.id);
      const next = exists
        ? prev.filter((t) => t.id !== topic.id)
        : [topic, ...prev];
      saveTopicsList(next);
      return next;
    });
  };

  const handleSaveProject = (project: StoryProject) => {
    setSavedProjects((prev) => {
      const exists = prev.some((p) => p.id === project.id);
      const next = exists
        ? prev.map((p) => (p.id === project.id ? project : p))
        : [project, ...prev];
      saveProjectsList(next);
      return next;
    });
  };

  const handleUpdateActiveProject = (
    updater: (prev: StoryProject) => StoryProject
  ) => {
    setActiveProject((prev) => {
      if (!prev) return prev;
      const updated = updater(prev);
      setSavedProjects((list) => {
        const exists = list.some((p) => p.id === updated.id);
        if (!exists) return list;
        const next = list.map((p) => (p.id === updated.id ? updated : p));
        saveProjectsList(next);
        return next;
      });
      return updated;
    });
  };

  const handleSendTopicToEngine = async (
    topic: StoryTopic,
    duration: DurationId
  ) => {
    setActiveTab('engine');
    setIsBuildingBlueprint(true);
    setBlueprintError(null);
    setActiveProject(null);

    try {
      const bp = await generateBlueprintApi({
        title: topic.title,
        premise: `${topic.coreConflict} চূড়ান্ত মোড়: ${topic.climaxMoment}`,
        coldOpenHook: topic.coldOpenHook,
        anchorObject: topic.anchorObject,
        anchorArc: topic.anchorArc,
        narratorPov: topic.narratorPov,
        dialect: topic.dialect,
        duration,
        characters: topic.characters,
        dnaInstruction: activeDna?.reusableSystemPrompt,
      });

      const now = new Date().toISOString();
      const project: StoryProject = {
        id: `story_${Date.now()}`,
        topicId: topic.id,
        title: bp.refinedTitle || topic.title,
        dialect: topic.dialect,
        duration,
        narratorPov: topic.narratorPov,
        musicDensity: 'balanced',
        anchorObject: bp.anchorObject || topic.anchorObject,
        anchorArc: bp.anchorArc || topic.anchorArc,
        closingMoralLine: bp.closingMoralLine || topic.closingMoralLine,
        premise: topic.coreConflict,
        characters: bp.characters?.length ? bp.characters : topic.characters,
        acts: bp.acts.map((a) => ({
          ...a,
          script: '',
          status: 'idle',
        })),
        dnaInspiration: activeDna?.sourceTitle,
        createdAt: now,
        updatedAt: now,
      };

      setActiveProject(project);
      handleSaveProject(project);
    } catch (err) {
      setBlueprintError(
        err instanceof Error
          ? err.message
          : '৭-অধ্যায়ের নীলনকশা তৈরি করা যায়নি। আবার চেষ্টা করুন।'
      );
    } finally {
      setIsBuildingBlueprint(false);
    }
  };

  const handleSaveDna = (dna: StoryDnaProfile) => {
    setSavedDnas((prev) => {
      const next = [dna, ...prev.filter((d) => d.id !== dna.id)];
      saveDnasList(next);
      return next;
    });
  };

  const handleApplyDnaToLab = (dna: StoryDnaProfile) => {
    setActiveDna(dna);
    setActiveTab('topics');
  };

  const handleStartNewStory = () => {
    setActiveProject(null);
    setBlueprintError(null);
    setActiveTab('engine');
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onStartNewStory={handleStartNewStory}
      />

      <main className="flex-1">
        {activeTab === 'topics' && (
          <TopicLab
            topics={generatedTopics}
            onTopicsGenerated={setGeneratedTopics}
            savedTopicIds={savedTopicIds}
            onToggleSaveTopic={handleToggleSaveTopic}
            onSendToEngine={handleSendTopicToEngine}
            activeDna={activeDna}
            onClearActiveDna={() => setActiveDna(null)}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        )}

        {activeTab === 'engine' && (
          <StoryEngine
            project={activeProject}
            isBuildingBlueprint={isBuildingBlueprint}
            blueprintError={blueprintError}
            onUpdateProject={handleUpdateActiveProject}
            onCreateCustomProject={(proj) => {
              setActiveProject(proj);
              handleSaveProject(proj);
            }}
            onSaveProject={handleSaveProject}
            activeDna={activeDna}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        )}

        {activeTab === 'dna' && (
          <DnaAnalyzer
            onApplyDnaToLab={handleApplyDnaToLab}
            onSaveDna={handleSaveDna}
          />
        )}

        {activeTab === 'library' && (
          <SavedLibrary
            savedProjects={savedProjects}
            savedTopics={savedTopics}
            savedDnas={savedDnas}
            onOpenProject={(proj) => {
              setActiveProject(proj);
              setActiveTab('engine');
            }}
            onDeleteProject={(id) => {
              setSavedProjects((prev) => {
                const next = prev.filter((p) => p.id !== id);
                saveProjectsList(next);
                return next;
              });
              if (activeProject?.id === id) setActiveProject(null);
            }}
            onSendTopicToEngine={handleSendTopicToEngine}
            onDeleteTopic={(id) => {
              setSavedTopics((prev) => {
                const next = prev.filter((t) => t.id !== id);
                saveTopicsList(next);
                return next;
              });
            }}
            onApplyDna={handleApplyDnaToLab}
            onDeleteDna={(id) => {
              setSavedDnas((prev) => {
                const next = prev.filter((d) => d.id !== id);
                saveDnasList(next);
                return next;
              });
            }}
          />
        )}
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6 mt-12">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8 flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-serif font-medium text-zinc-700 dark:text-zinc-300">
            কথাকুঞ্জ — বাংলা অডিও-স্টোরি ও টপিক স্টুডিও
          </span>
          <span>বাংলা কথ্য আখ্যান, ৭-অধ্যায় স্ক্রিপ্ট ও প্রোডাকশন কিট</span>
        </div>
      </footer>
    </div>
  );
}
